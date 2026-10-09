-- Private catalog only; existing profile/media/booking rows and private buckets stay intact.
CREATE TABLE public.media_library_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL,
 bucket_id text NOT NULL CHECK (bucket_id IN ('company-media','ad-media','project-media')),
 storage_path text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('gallery','logo','contact','block','banner')),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '' CHECK (char_length(description)<=2000),
 alt_text text NOT NULL DEFAULT '' CHECK (char_length(alt_text)<=500),
 source text NOT NULL DEFAULT '' CHECK (char_length(source)<=1000),
 rights text NOT NULL DEFAULT '' CHECK (char_length(rights)<=1000),
 sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 archived_at timestamptz, deletion_requested_at timestamptz, deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(bucket_id,storage_path)
);
CREATE INDEX media_library_profile_page ON public.media_library_assets(profile_id,created_at DESC,id);
CREATE INDEX media_library_hash ON public.media_library_assets(profile_id,sha256) WHERE sha256 IS NOT NULL;
CREATE TABLE public.media_library_files (
 bucket_id text NOT NULL CHECK (bucket_id IN ('company-media','ad-media','project-media')),
 storage_path text NOT NULL,
 asset_id uuid NOT NULL REFERENCES public.media_library_assets(id),
 profile_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL,
 context_key text NOT NULL,
 PRIMARY KEY(bucket_id,storage_path), UNIQUE(asset_id,context_key)
);
CREATE INDEX media_library_files_asset ON public.media_library_files(asset_id);
CREATE INDEX media_library_files_profile ON public.media_library_files(profile_id);
ALTER TABLE public.media_library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_library_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_library_assets,public.media_library_files FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.media_library_assets,public.media_library_files TO authenticated;
GRANT UPDATE(name,description,alt_text,source,rights,sha256,archived_at) ON public.media_library_assets TO authenticated;
CREATE POLICY media_library_assets_admin ON public.media_library_assets FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
CREATE POLICY media_library_files_admin ON public.media_library_files FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));

-- Register metadata, never copy or mutate an existing Storage object.
CREATE FUNCTION private.catalog_media_object(p_bucket text,p_path text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset uuid; profile uuid; kind text;
BEGIN
 SELECT asset_id INTO asset FROM public.media_library_files WHERE bucket_id=p_bucket AND storage_path=p_path;
 IF asset IS NOT NULL THEN RETURN asset; END IF;
 IF p_bucket='company-media' AND p_path ~ '^profiles/[0-9a-f-]{36}/(gallery|logo|contact|blocks)/' THEN
  profile:=split_part(p_path,'/',2)::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE id=profile) THEN RETURN NULL; END IF;
  kind:=CASE split_part(p_path,'/',3) WHEN 'blocks' THEN 'block' ELSE split_part(p_path,'/',3) END;
 ELSIF p_bucket='ad-media' THEN kind:='banner';
 ELSE RETURN NULL; END IF;
 IF p_path !~ '\.(jpg|png|webp)$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=p_path) THEN RETURN NULL; END IF;
 INSERT INTO public.media_library_assets(profile_id,bucket_id,storage_path,kind,name)
 VALUES(profile,p_bucket,p_path,kind,left(regexp_replace(p_path,'^.*/',''),200))
 ON CONFLICT(bucket_id,storage_path) DO UPDATE SET storage_path=EXCLUDED.storage_path RETURNING id INTO asset;
 INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,profile_id,context_key)
 VALUES(p_bucket,p_path,asset,profile,'original') ON CONFLICT DO NOTHING;
 RETURN asset;
END; $$;
REVOKE ALL ON FUNCTION private.catalog_media_object(text,text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE o record; BEGIN
 FOR o IN SELECT bucket_id,name FROM storage.objects WHERE bucket_id IN ('company-media','ad-media') AND name ~ '\.(jpg|png|webp)$'
 LOOP PERFORM private.catalog_media_object(o.bucket_id,o.name); END LOOP;
END; $$;

CREATE FUNCTION private.media_library_references(p_bucket text,p_path text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('label',label,'profileId',profile_id,'id',id)),'[]'::jsonb) FROM (
 SELECT 'Unternehmensgalerie'::text label,i.profile_id,i.id FROM public.company_profile_images i WHERE p_bucket='company-media' AND i.storage_path=p_path
 UNION ALL SELECT 'Logo',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-media' AND p.logo_path=p_path
 UNION ALL SELECT 'Ansprechpartnerbild',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-media' AND p.contact_image_path=p_path
 UNION ALL SELECT 'Inhaltsblock',b.profile_id,i.id FROM public.profile_content_block_images i JOIN public.profile_content_blocks b ON b.id=i.block_id WHERE p_bucket='company-media' AND i.storage_path=p_path
 UNION ALL SELECT 'Werbebanner',c.profile_id,c.id FROM public.company_ad_campaigns c WHERE p_bucket='ad-media' AND c.image_path=p_path
 ) refs;
$$;
REVOKE ALL ON FUNCTION private.media_library_references(text,text) FROM PUBLIC,anon,authenticated;

-- All references serialize with a deletion request via the catalog asset row.
-- No custom trigger on Supabase's managed storage.objects table.
CREATE FUNCTION private.guard_catalog_media_reference() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE paths text[]; path text; asset uuid; removing timestamptz;
BEGIN
 IF TG_TABLE_NAME='company_profiles' THEN paths:=ARRAY[NEW.logo_path,NEW.contact_image_path];
 ELSIF TG_TABLE_NAME='company_ad_campaigns' THEN paths:=ARRAY[NEW.image_path];
 ELSE paths:=ARRAY[NEW.storage_path]; END IF;
 FOREACH path IN ARRAY paths LOOP
  IF path IS NULL THEN CONTINUE; END IF;
  SELECT a.id,a.deletion_requested_at INTO asset,removing FROM public.media_library_files f
   JOIN public.media_library_assets a ON a.id=f.asset_id
   WHERE f.storage_path=path AND f.bucket_id=CASE WHEN TG_TABLE_NAME='company_ad_campaigns' THEN 'ad-media' ELSE 'company-media' END
   FOR SHARE OF a;
  IF removing IS NOT NULL THEN RAISE EXCEPTION 'media deletion in progress'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_catalog_media_reference() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER catalog_gallery_reference BEFORE INSERT OR UPDATE OF storage_path ON public.company_profile_images FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_media_reference();
CREATE TRIGGER catalog_block_reference BEFORE INSERT OR UPDATE OF storage_path ON public.profile_content_block_images FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_media_reference();
CREATE TRIGGER catalog_profile_reference BEFORE INSERT OR UPDATE OF logo_path,contact_image_path ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_media_reference();
CREATE TRIGGER catalog_banner_reference BEFORE INSERT OR UPDATE OF image_path ON public.company_ad_campaigns FOR EACH ROW EXECUTE FUNCTION private.guard_catalog_media_reference();

CREATE FUNCTION private.catalog_media_after_use() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='company_profiles' THEN
  PERFORM private.catalog_media_object('company-media',NEW.logo_path);
  PERFORM private.catalog_media_object('company-media',NEW.contact_image_path);
 ELSIF TG_TABLE_NAME='company_ad_campaigns' THEN PERFORM private.catalog_media_object('ad-media',NEW.image_path);
 ELSE PERFORM private.catalog_media_object('company-media',NEW.storage_path); END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.catalog_media_after_use() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER catalog_gallery_use AFTER INSERT OR UPDATE OF storage_path ON public.company_profile_images FOR EACH ROW EXECUTE FUNCTION private.catalog_media_after_use();
CREATE TRIGGER catalog_block_use AFTER INSERT OR UPDATE OF storage_path ON public.profile_content_block_images FOR EACH ROW EXECUTE FUNCTION private.catalog_media_after_use();
CREATE TRIGGER catalog_profile_use AFTER INSERT OR UPDATE OF logo_path,contact_image_path ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION private.catalog_media_after_use();
CREATE TRIGGER catalog_banner_use AFTER INSERT OR UPDATE OF image_path ON public.company_ad_campaigns FOR EACH ROW EXECUTE FUNCTION private.catalog_media_after_use();

CREATE FUNCTION private.media_library_delete_allowed(p_bucket text,p_path text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.media_library_files WHERE bucket_id=p_bucket AND storage_path=p_path)
 OR (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) AND EXISTS(
 SELECT 1 FROM public.media_library_files f JOIN public.media_library_assets a ON a.id=f.asset_id
 WHERE f.bucket_id=p_bucket AND f.storage_path=p_path AND a.deletion_requested_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.media_library_files sibling WHERE sibling.asset_id=a.id
 AND jsonb_array_length(private.media_library_references(sibling.bucket_id,sibling.storage_path))>0)));
$$;
REVOKE ALL ON FUNCTION private.media_library_delete_allowed(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.media_library_delete_allowed(text,text) TO authenticated;
CREATE POLICY media_library_original_retention ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (bucket_id <> 'company-media' OR private.media_library_delete_allowed(bucket_id,name));

-- Invoker RPCs expose catalog metadata only after the existing admin check; RLS remains active.
CREATE FUNCTION public.media_library_page(p_profile uuid DEFAULT NULL,p_kind text DEFAULT '',p_query text DEFAULT '',p_page integer DEFAULT 1,p_archived boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE items jsonb; total integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_page<1 OR p_page>100000 OR char_length(p_query)>200 OR p_kind NOT IN ('','gallery','logo','contact','block','banner','unused') THEN RAISE EXCEPTION 'invalid catalog query'; END IF;
 WITH matches AS (SELECT a.*,p.display_name profile_name FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id
 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived)
 AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id)) AND (p_kind IN ('','unused') OR a.kind=p_kind)
 AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')
 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0)))
 SELECT count(*) INTO total FROM matches;
 SELECT coalesce(jsonb_agg(item),'[]'::jsonb) INTO items FROM (
 SELECT to_jsonb(a)||jsonb_build_object('profile_name',p.display_name,'preview_file',(SELECT jsonb_build_object('bucket',f.bucket_id,'path',f.storage_path) FROM public.media_library_files f WHERE f.asset_id=a.id AND (f.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=f.bucket_id AND o.name=f.storage_path)) ORDER BY (f.context_key='original') DESC,f.storage_path LIMIT 1),'usages',coalesce((SELECT jsonb_agg(u) FROM public.media_library_files f CROSS JOIN LATERAL jsonb_array_elements(public.media_library_asset_references(f.bucket_id,f.storage_path)) u WHERE f.asset_id=a.id),'[]'::jsonb)) item
 FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id
 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived) AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id))
 AND (p_kind IN ('','unused') OR a.kind=p_kind) AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')
 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0))
 ORDER BY a.created_at DESC,a.id LIMIT 24 OFFSET (p_page-1)*24) page;
 RETURN jsonb_build_object('items',items,'count',total);
END; $$;
-- Private reference helper is not an exposed PostgREST RPC. Every caller must be an admin.
CREATE FUNCTION public.media_library_usages(p_asset uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(u),'[]'::jsonb) INTO result FROM public.media_library_files f CROSS JOIN LATERAL jsonb_array_elements(public.media_library_asset_references(f.bucket_id,f.storage_path)) u WHERE f.asset_id=p_asset;
 RETURN result;
END; $$;
-- Admin-gated wrapper for internal references: required by invoker page/usages RPCs.
CREATE FUNCTION private.admin_media_references(p_bucket text,p_path text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 RETURN private.media_library_references(p_bucket,p_path);
END; $$;
REVOKE ALL ON FUNCTION private.admin_media_references(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_media_references(text,text) TO authenticated;
-- Parsed SQL bodies bind the private helper at creation. No schema USAGE grant is needed.
-- The private helper still performs the existing admin check and requires explicit EXECUTE.
CREATE FUNCTION public.media_library_asset_references(p_bucket text,p_path text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
 BEGIN ATOMIC SELECT private.admin_media_references(p_bucket,p_path); END;
REVOKE ALL ON FUNCTION public.media_library_asset_references(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_asset_references(text,text) TO authenticated;


CREATE FUNCTION public.media_library_request_delete(p_asset uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.media_library_assets; files jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.media_library_assets WHERE id=p_asset FOR UPDATE;
 IF NOT FOUND OR a.archived_at IS NULL OR a.bucket_id <> 'company-media' THEN RAISE EXCEPTION 'archive image first'; END IF;
 IF jsonb_array_length(public.media_library_usages(p_asset))>0 THEN RAISE EXCEPTION 'image is still in use'; END IF;
 UPDATE public.media_library_assets SET deletion_requested_at=now() WHERE id=p_asset;
 SELECT jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',storage_path)) INTO files FROM public.media_library_files WHERE asset_id=p_asset;
 RETURN coalesce(files,'[]'::jsonb);
END; $$;
GRANT UPDATE(deletion_requested_at) ON public.media_library_assets TO authenticated;
-- A guard prevents arbitrary direct requests through the column grant.
CREATE FUNCTION private.guard_media_library_delete_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
  IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) OR NEW.archived_at IS NULL
   OR EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=NEW.id AND jsonb_array_length(private.media_library_references(f.bucket_id,f.storage_path))>0) THEN RAISE EXCEPTION 'image is still in use or not archived'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_media_library_delete_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER media_library_delete_request BEFORE UPDATE OF deletion_requested_at ON public.media_library_assets FOR EACH ROW EXECUTE FUNCTION private.guard_media_library_delete_request();
REVOKE ALL ON FUNCTION public.media_library_page(uuid,text,text,integer,boolean),public.media_library_usages(uuid),public.media_library_request_delete(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_page(uuid,text,text,integer,boolean),public.media_library_usages(uuid),public.media_library_request_delete(uuid) TO authenticated;

-- Atomically register a validated upload without consuming a public gallery place.
CREATE FUNCTION public.media_library_register_upload(p_profile uuid,p_path text,p_name text,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE asset uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_path !~ ('^profiles/'||p_profile::text||'/gallery/[0-9a-f-]{36}\.(jpg|png|webp)$') OR NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE id=p_profile) OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='company-media' AND name=p_path) THEN RAISE EXCEPTION 'invalid original'; END IF;
 INSERT INTO public.media_library_assets(profile_id,bucket_id,storage_path,kind,name,sha256) VALUES(p_profile,'company-media',p_path,'gallery',p_name,p_hash) RETURNING id INTO asset;
 INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,profile_id,context_key) VALUES('company-media',p_path,asset,p_profile,'original');
 RETURN asset;
END; $$;
REVOKE ALL ON FUNCTION public.media_library_register_upload(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_register_upload(uuid,text,text,text) TO authenticated;

CREATE FUNCTION private.guard_media_library_file() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.media_library_assets;
BEGIN
 SELECT * INTO a FROM public.media_library_assets WHERE id=NEW.asset_id FOR SHARE;
 IF NOT FOUND OR a.deletion_requested_at IS NOT NULL OR (NEW.bucket_id <> 'project-media' AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=NEW.bucket_id AND name=NEW.storage_path)) THEN RAISE EXCEPTION 'original unavailable'; END IF;
 IF NEW.context_key='original' THEN
  IF NEW.bucket_id<>a.bucket_id OR NEW.storage_path<>a.storage_path OR NEW.profile_id IS DISTINCT FROM a.profile_id THEN RAISE EXCEPTION 'invalid original identity'; END IF;
 ELSE
  IF NEW.bucket_id<>'company-media' OR NEW.profile_id IS NULL OR NEW.storage_path NOT LIKE 'profiles/'||NEW.profile_id::text||'/%' OR NEW.context_key NOT LIKE NEW.profile_id::text||':%' THEN RAISE EXCEPTION 'invalid copy identity'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_media_library_file() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER media_library_file_guard BEFORE INSERT ON public.media_library_files FOR EACH ROW EXECUTE FUNCTION private.guard_media_library_file();
CREATE FUNCTION public.media_library_finish_delete(p_asset uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 UPDATE public.media_library_assets SET deleted_at=now() WHERE id=p_asset AND deletion_requested_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'no deletion request'; END IF;
END; $$;
GRANT UPDATE(deleted_at) ON public.media_library_assets TO authenticated;
CREATE FUNCTION private.guard_media_library_deleted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND (NEW.deletion_requested_at IS NULL OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=NEW.id)) THEN RAISE EXCEPTION 'original still exists'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_media_library_deleted() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER media_library_deleted_guard BEFORE UPDATE OF deleted_at ON public.media_library_assets FOR EACH ROW EXECUTE FUNCTION private.guard_media_library_deleted();
REVOKE ALL ON FUNCTION public.media_library_finish_delete(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_finish_delete(uuid) TO authenticated;

-- Find interrupted/unreferenced uploads when opening the catalog, at most 500 new objects per pass.
CREATE FUNCTION private.admin_media_library_sync() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o record; total integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 FOR o IN SELECT s.bucket_id,s.name FROM storage.objects s WHERE s.bucket_id IN ('company-media','ad-media') AND s.name ~ '\.(jpg|png|webp)$' AND NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.bucket_id=s.bucket_id AND f.storage_path=s.name) ORDER BY s.id LIMIT 500
 LOOP IF private.catalog_media_object(o.bucket_id,o.name) IS NOT NULL THEN total:=total+1; END IF; END LOOP;
 RETURN total;
END; $$;
REVOKE ALL ON FUNCTION private.admin_media_library_sync() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_media_library_sync() TO authenticated;
CREATE FUNCTION public.media_library_sync() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' BEGIN ATOMIC SELECT private.admin_media_library_sync(); END;
REVOKE ALL ON FUNCTION public.media_library_sync() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_sync() TO authenticated;

-- Existing alt texts are authoritative; never manufacture metadata/rights.
UPDATE public.media_library_assets a SET alt_text=coalesce((SELECT i.alt_text FROM public.company_profile_images i WHERE a.bucket_id='company-media' AND i.storage_path=a.storage_path AND i.alt_text IS NOT NULL ORDER BY i.sort_order,i.id LIMIT 1),(SELECT i.alt_text FROM public.profile_content_block_images i WHERE a.bucket_id='company-media' AND i.storage_path=a.storage_path AND i.alt_text IS NOT NULL ORDER BY i.sort_order,i.id LIMIT 1),'');

-- Read-only boolean for existing cleanup callers; never returns catalog metadata to owners.
CREATE FUNCTION private.media_library_retains_file(p_bucket text,p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_bucket='company-media' AND EXISTS(SELECT 1 FROM public.media_library_files f JOIN public.media_library_assets a ON a.id=f.asset_id WHERE f.bucket_id=p_bucket AND f.storage_path=p_path AND a.deletion_requested_at IS NULL)
 AND (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) OR EXISTS(SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE c.owner_user_id=(SELECT auth.uid()) AND p_path LIKE 'profiles/'||p.id::text||'/%'));
$$;
REVOKE ALL ON FUNCTION private.media_library_retains_file(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.media_library_retains_file(text,text) TO authenticated;
CREATE FUNCTION public.media_library_retains_file(p_bucket text,p_path text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' BEGIN ATOMIC SELECT private.media_library_retains_file(p_bucket,p_path); END;
REVOKE ALL ON FUNCTION public.media_library_retains_file(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_retains_file(text,text) TO authenticated;

-- Existing, hash-verified public project originals. This does not upload files or change any profile/gallery.
WITH sources(slug,kind,path,alt,source,sha) AS (VALUES
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/01.jpg','Originalbild 1 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','6d01ea0a6617ab59cbc67dba3da2ac79625324d0dbee02e8d8b14ce1f1cc7a75'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/02.jpg','Originalbild 2 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','fed6a2fa10255f16f79c517c4fabc989c4ecc7d517794346256e300cdc5976b1'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/03.jpg','Originalbild 3 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','5f5319ccfdb22731ae57b1467e029da7aaea9756c767b251ed09272e80a2d9f6'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/04.jpg','Originalbild 4 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','ab97a70b045b0d75c799e3991ed081489abd95460bda34d64bde80c3502a6159'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/05.jpg','Originalbild 5 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','30ca2e66eb04a32ac68748f731376ded199a49da2aa49c5506fdb259c5980b2b'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/06.jpg','Originalbild 6 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','3969f73795fa5a6e6f9f315630ac2ff594214601d2aefd26f6e7e044014e2d17'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/07.jpg','Originalbild 7 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','5aa940aeef7693ab72662cc9bd5ed3d5b34df8443dfd79fdf08c727bcc885d36'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/08.jpg','Originalbild 8 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','e33855214fa188ae3440b57b76ed6be4c58099dcf88b0a90699b1ecf0dc9c7fb'),
('anni-romantikhaeuschen','gallery','/reiseportal/unterkuenfte/anni-romantikhaeuschen/09.jpg','Originalbild 9 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','e3c1acbe568b2efdc92941c002dde48b7989931d4ef80765f2b717b59cc571a8'),
('anni-romantikhaeuschen','gallery','/reiseportal/legacy-provider-media/anni-romantikhaeuschen/10.png','Originalbild 10 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','a8bbeced57ca5af4ad200140fe5bbd971d54ef59a2d9fe05e5e0efc300f45b54'),
('anni-romantikhaeuschen','gallery','/reiseportal/legacy-provider-media/anni-romantikhaeuschen/11.png','Originalbild 11 von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','8899ea946d8a9db12d5ae8c39f05f5c3fb036b5827f893f004a92eb548eafb8f'),
('anni-romantikhaeuschen','gallery','/reiseportal/legacy-provider-media/anni-romantikhaeuschen/12.jpg','Belegtes ursprüngliches Anbieterfoto von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','211beddc08792bf3f1ae0908e8c6ac1db29c1a5dc12ebc2091447562e8735ea1'),
('anni-romantikhaeuschen','logo','/reiseportal/unterkuenfte/anni-romantikhaeuschen/logo.jpg','Originales Anbieterlogo von Anni´s Romantikhäuschen in der Sächsische Schweiz','Belegter Projekt-/Joomla-Medienbestand','21d4a03280f34d65480f117719c66b58305cff64fb2fd7fabe79a8ab8ff1247a'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/01.jpg','Originalbild 1 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','e8ac489709a34f17440c63c810c39ce66873ea420e114d22c1046f2385ea8db8'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/02.jpg','Originalbild 2 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','c88f896c5c5097a485baeaad437e213e67fd3658bcd46f0964f167d0e7e7916b'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/03.jpg','Originalbild 3 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','e03955454eb74af2bcbcaa0e9daae7a29c904c3d4851846efff8e21efb1da1a0'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/04.jpg','Originalbild 4 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','56136af4cbd5257ec952a1bfca54d4758f3601fc84f1e76876f8cd9f8141c093'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/unterkuenfte/apartbauernhof-valrunzhof/02.jpg','Originalbild 5 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','fbfe1171f15637eaf249afc42f5ec2d1322d63398e7be16767bec24dfa07a3c0'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/unterkuenfte/apartbauernhof-valrunzhof/01.jpg','Originalbild 6 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','c49cfc9f64d909ce55805ac900e9caa6f13e4b52344ea8fcb0b7a684741b7574'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/07.jpg','Originalbild 7 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','eae3002bc62a00082d4604349dfeea7a4a1ee6673d32a88b8bbca610b38ca5ab'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/08.jpg','Originalbild 8 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','8e86dcedfbb238aa11cfa6d2ca1feaa95e8754cd2cb99d5114beefb4f744695a'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/09.png','Originalbild 9 von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','acaa6e6edc7c7c772ec84556275f2bf61aca4404ffa25a9840e8de8ff9859879'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-provider-media/apartbauernhof-valrunzhof/10.jpg','Belegtes ursprüngliches Anbieterfoto von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','73ce6bcea7cb6bcc86d411688b04a73372927aa03b9b21fe37c165bc24aa2188'),
('apartbauernhof-valrunzhof','logo','/reiseportal/unterkuenfte/apartbauernhof-valrunzhof/logo.jpg','Originales Anbieterlogo von Apartbauernhof Valrunzhof','Belegter Projekt-/Joomla-Medienbestand','a2999c58e853143022b7e0fc4230c08885f79f22d36e8135aad1fae504592a7e'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/01.jpg','Originalbild 1 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','4925c045969b984040134001a987f4988d3416aa62ac600248cd877a163d46ea'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/02.jpg','Originalbild 2 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','983f555a48cc17a80fcfe15f34f1c3782432e9d18482d1a857972526ebb7d2e3'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/03.jpg','Originalbild 3 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','efe89a4be72bad549749837d10e831d44c931214df87192a49cb2dffa7a52ced'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/04.jpg','Originalbild 4 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','b2a5de521b9d7291ad483dd65afe8f7536730031faff6084947f9ccbcc365edf'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/05.png','Originalbild 5 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','10506649fa26f66b511c1de418067fa3737da00c5f2dca92e2f5b25545361b04'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/06.jpg','Originalbild 6 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','5c2769d964c84fc8bce9a7c9caac69a251efb4ff4321ed56861206125ad31d19'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/07.jpg','Originalbild 7 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','d3b240a1ae50a815f96044f80acbcc74ef840920d5f23b7bf3d1aa9100fbdf71'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/08.jpg','Originalbild 8 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','2e6ce2e7fd916b5a70f6b910cea8ad5930a044cafcaf36e52a82b82e910b252c'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/09.jpg','Originalbild 9 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','134d926484726bf9d3e50499253bc5ece7c8cfa5b7714b31c68331d871a94eb7'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-provider-media/appartementhaus-salzburg/10.jpg','Originalbild 10 von Appartementhaus Salzburg','Belegter Projekt-/Joomla-Medienbestand','244ab61f66c067625df175302b181ba656eedfaac833f03dfd405d7136b72ae6'),
('bayerischer-wald','gallery','/reiseportal/unterkuenfte/bayerischer-wald/01.jpg','Originalbild 1 von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','198311a9c7ca5a02b29ca29413f99a78caa4ef6233e632d5178241c5940cd22a'),
('bayerischer-wald','gallery','/reiseportal/unterkuenfte/bayerischer-wald/02.jpg','Originalbild 2 von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','5f86d2a16752084ac901ee92be438e037b7a69dd350ecad54558b2e8aac4c2f8'),
('bayerischer-wald','gallery','/reiseportal/unterkuenfte/bayerischer-wald/03.jpg','Originalbild 3 von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','4261cc85a9f9fe4d96e2ea3f9a82433b830134d4c41fc03a821fa4ecf4b520ab'),
('bayerischer-wald','gallery','/reiseportal/unterkuenfte/bayerischer-wald/04.jpg','Originalbild 4 von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','21ca4a3b1d196bad8b0288d3b5a0bb767cec193a91be7edc6c184eb51c3564f1'),
('bayerischer-wald','gallery','/reiseportal/legacy-provider-media/bayerischer-wald/05.jpg','Originalbild 5 von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','6bb635f7b1eac1bc43d44bf125827338930d310c0d336f70766f18c21735cbac'),
('bayerischer-wald','gallery','/reiseportal/legacy-provider-media/bayerischer-wald/06.jpg','Originalbild 6 von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','aa3f938fbeec2153422ff9a1277491f017c24c1c2c446534b77ccf775b61dfbe'),
('bayerischer-wald','gallery','/reiseportal/legacy-provider-media/bayerischer-wald/07.jpg','Belegtes ursprüngliches Anbieterfoto von Bayerischer Wald','Belegter Projekt-/Joomla-Medienbestand','0930e1870a0531d24a84baa24e75b777c1ae4356f92d7646738dad182d71e11c'),
('blausee','gallery','/reiseportal/unterkuenfte/blausee/01.jpg','Originalbild 1 von Blausee','Belegter Projekt-/Joomla-Medienbestand','3133325b240e6cd2c982f551d5a76efde9608d8f47a4a869c4e6cc1e4a704839'),
('blausee','gallery','/reiseportal/unterkuenfte/blausee/02.jpg','Originalbild 2 von Blausee','Belegter Projekt-/Joomla-Medienbestand','17f690e305b7b4cd565e2fcf11211b245efc757d041fa5ca45c0ef1416bfc7ef'),
('blausee','gallery','/reiseportal/unterkuenfte/blausee/logo.png','Originalbild 3 von Blausee','Belegter Projekt-/Joomla-Medienbestand','c8e30d4be5df6cfb995567fbec4b888f2346b250c0ef25df73ab880787b38407'),
('blausee','gallery','/reiseportal/legacy-provider-media/blausee/04.jpg','Originalbild 4 von Blausee','Belegter Projekt-/Joomla-Medienbestand','9bf4c35c08761e055d7f6a023ad6dde2d801b316f74718b4b7526090112ab55a'),
('blausee','gallery','/reiseportal/legacy-provider-media/blausee/05.jpg','Originalbild 5 von Blausee','Belegter Projekt-/Joomla-Medienbestand','e26ea8c87bb13b07f7b9ee4984018ee11a2f439df80f0a20375e0c370afdff7f'),
('blausee','gallery','/reiseportal/legacy-provider-media/blausee/06.jpg','Originalbild 6 von Blausee','Belegter Projekt-/Joomla-Medienbestand','0ed4ce32ccfd7733e4030c7eed35430026cb0a5e5b80f7535003193946e438b2'),
('blausee','gallery','/reiseportal/legacy-provider-media/blausee/07.jpg','Originalbild 7 von Blausee','Belegter Projekt-/Joomla-Medienbestand','1e4a88190500a87ae12a1a563289121f3246ef231287c7e6546c53fe687ae351'),
('blausee','gallery','/reiseportal/legacy-provider-media/blausee/08.jpg','Originalbild 8 von Blausee','Belegter Projekt-/Joomla-Medienbestand','e31bb62c08806f49c2fbb3ae1d438247494868ed3c38e7aef0bfb3de5364302e'),
('blausee','gallery','/reiseportal/legacy-provider-media/blausee/09.jpg','Originalbild 9 von Blausee','Belegter Projekt-/Joomla-Medienbestand','0799ef1df7e445f9484f05e4c33e36b1bc65cbd390b1e29e2a0dc59c25648f46'),
('camping-resort-allweglehen','gallery','/reiseportal/unterkuenfte/camping-resort-allweglehen/01.jpg','Originalbild 1 von Camping Resort Allweglehen','Belegter Projekt-/Joomla-Medienbestand','7f94baed942667e986c23c62f5bceb4831ff3e5daca520ba49910b0a904038ea'),
('camping-resort-allweglehen','gallery','/reiseportal/unterkuenfte/camping-resort-allweglehen/02.jpg','Originalbild 2 von Camping Resort Allweglehen','Belegter Projekt-/Joomla-Medienbestand','da539d7b3681b9168663aed2380993b23b5952fc3372ce203590310ba32ae3ca'),
('camping-resort-allweglehen','gallery','/reiseportal/legacy-provider-media/camping-resort-allweglehen/03.jpg','Originalbild 3 von Camping Resort Allweglehen','Belegter Projekt-/Joomla-Medienbestand','fbd5a9be21c402777992411735214610536ff76f48e9470910654a3be37af270'),
('camping-resort-allweglehen','gallery','/reiseportal/legacy-provider-media/camping-resort-allweglehen/04.png','Originalbild 4 von Camping Resort Allweglehen','Belegter Projekt-/Joomla-Medienbestand','3ab551f791d661239db24f7e4dd85108d6abd898bd538b51c2b1f40a8cbfa4a7'),
('camping-resort-allweglehen','gallery','/reiseportal/legacy-provider-media/camping-resort-allweglehen/05.jpg','Originalbild 5 von Camping Resort Allweglehen','Belegter Projekt-/Joomla-Medienbestand','f23ffa00b0cae6ceda6587a01288c6ea59d0b086a5edf4ad30b09bf0e3a0768a'),
('camping-resort-allweglehen','gallery','/reiseportal/legacy-provider-media/camping-resort-allweglehen/06.jpg','Originalbild 6 von Camping Resort Allweglehen','Belegter Projekt-/Joomla-Medienbestand','6f504436046ef805e9e231a438fd17ffaee7ff7649e4baec6819b5a2c70fdbaf'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/01.jpg','Originalbild 1 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','4b6438a3604f0cfa487e41920fe7a9ddc8c01a8cc6948e0552c2ba5516858082'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/02.jpg','Originalbild 2 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','ef61053138481d569a536a511fc67b1deb338ccd5086fbe5b1966a6021ca84ff'),
('city-apart-dresden','gallery','/reiseportal/unterkuenfte/city-apart-dresden/01.jpg','Originalbild 3 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','2e38ad404970c36fae3d9a01560d623e63b13d2eb382a746601eaf611d448d15'),
('city-apart-dresden','gallery','/reiseportal/unterkuenfte/city-apart-dresden/02.jpg','Originalbild 4 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','5620906cbda1bbd44b30366b6cf879b254f9b6adb0d056e141fa1d0d0c4f154f'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/05.jpg','Originalbild 5 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','369e9db762957f6f0189521b0d9f27c2e593deadb2f99a411871e55a885c5c92'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/06.jpg','Originalbild 6 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','393de76863aef5f46f8864dc8e22787e0cb2f3a49103988066a7c27db6d7e2b6'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/07.jpg','Originalbild 7 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','03ea6168366fed16b61e556f6a49baf6043373479982b713092bdfb4a51f3f4b'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/08.jpg','Originalbild 8 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','fc8977abb9cf920bc310d44b343a48bb1ebd87773775c7969161545241ada2f4'),
('city-apart-dresden','gallery','/reiseportal/legacy-provider-media/city-apart-dresden/09.jpg','Originalbild 9 von City Apart Dresden','Belegter Projekt-/Joomla-Medienbestand','57f8bf5d01ace9ac564a1b895e1eeb6a8d3d4ed258d5129131bf24304776af9c'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/unterkuenfte/das-5-sterne-wellness-hotel-stock-resort/01.jpg','Originalbild 1 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','e0706ab397fb95465618431dd2dbd039263a222d4d5e75952d1ab94767ca97a5'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/unterkuenfte/das-5-sterne-wellness-hotel-stock-resort/02.jpg','Originalbild 2 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','6d0dbbbd26b811957f22557bcd65fc4c432bc1916b1d181245cd28aedde023cc'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/03.jpg','Originalbild 3 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','f2274d1c23926cc400a913f9039fccbd59f9d8f1bf704b5624d422707861d23a'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/04.jpg','Originalbild 4 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','abdc75e485c3f96ab87282199ef85247eca448dbcc79028162a62075697b3561'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/05.jpg','Originalbild 5 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','00663ecb578863fcb49a5fae960671cb6a9619407fe62d51f94877306cfb8030'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/06.jpg','Originalbild 6 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','c80d003d9cc9245d234d744a35b344760912442cf58cc14c6ffc1539a4205e3c'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/07.jpg','Originalbild 7 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','4b1320a3b003a1856c8e34ba8789c1b62e21459f0ac6a6b959b651ae22902ac1'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/08.jpg','Originalbild 8 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','7fe7a0580554e391c08b5392670730ca0bc1e683a19dbb9292eb83a694dd44c9'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-provider-media/das-5-sterne-wellness-hotel-stock-resort/09.jpg','Originalbild 9 von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','1c0cb849cb847ce0c06cde8533ae1ee1cb7e26b4f90d033f50fe91196858e7fc'),
('das-5-sterne-wellness-hotel-stock-resort','logo','/reiseportal/unterkuenfte/das-5-sterne-wellness-hotel-stock-resort/logo.jpg','Originales Anbieterlogo von Das 5-Sterne-Wellness-Hotel STOCK resort','Belegter Projekt-/Joomla-Medienbestand','e895095c5be06f8dda0ebe55493b4e15f869bfc4eec6aa8a554b007ed64a0771'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/01.jpg','Originalbild 1 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','8e809bc8d3b0cb6c1856b0d74b8f256f1a61a62c5288cb0c5a0c889dcd1b2256'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/02.jpg','Originalbild 2 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','1584564bf95e5e49b4f1ffd605ec158dd110723cc27da8d0b93f860a01b6747e'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/03.jpg','Originalbild 3 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','8e48b1ec1aa74307ea4356795d787b62213ef68af3ebb36f61f41baa5154c77a'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/04.jpg','Originalbild 4 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','51af3a2154ab9fab04abb52461484d1158f26bc7055dd8452a47983e62f8955c'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/05.jpg','Originalbild 5 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','83c78b2adcd1055308c9aafb30fad7642a8d3ee0f833442cab9353a8b839dacb'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/06.jpg','Originalbild 6 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','f960fe56d5efca6f2ea6b07920d8d5dc8c086b544b0bc031ac04736798fa28de'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/07.jpg','Originalbild 7 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','97c25d7cf23e4ce526d05ebfbbdfeb7253bdc3bf60691b41d388cbf2dbe6eef4'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/08.jpg','Originalbild 8 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','a7cbcb74d4642b8c07d18428722f6cc2e7c8df6319c598836e2f9df66943abf3'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/09.jpg','Originalbild 9 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','f4b57f098a016b4d5426661cfab62da0837737d385fb3783d5636e320cd19ac1'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/unterkuenfte/der-koenigsleitner-romantik-zu-zweit/01.jpg','Originalbild 10 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','37d050c9c581e47648b1d5c3c83db2802caacd1d722cbc651ea42acedbaa2bf7'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/11.jpg','Originalbild 11 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','19a9cd9a766a8b80b86e7b6f02de67f6ddf92ba28bf7d082fa6e9ee205ea543c'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/12.jpg','Originalbild 12 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','2f4ec636e14a19b502de39ba396867ff08f1abfca08d646da46a53e7f348a540'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/unterkuenfte/der-koenigsleitner-romantik-zu-zweit/02.jpg','Originalbild 13 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','e987f9a7e3df6e0d27836db149f6fd78077ebce9a48054fe97374173d078c7c9'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/14.jpg','Originalbild 14 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','f5b43075e50baf6c271701020581b0d53cc6fd75e8f60bcfaa3ba3f2f65e6b31'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/15.jpg','Originalbild 15 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','2147351b4ccbf2f12dea6fed659787bbd82be4ff10b4d167553f3cb445d720a5'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/unterkuenfte/der-koenigsleitner-romantik-zu-zweit/logo.png','Originalbild 16 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','cd31915faf4353f3fb6f114567f319fa708f7702322a17f3d137fb08f7b5ca93'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/17.jpg','Originalbild 17 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','ffc82c81132dee3404ef95707ab3a59049ad1f7fd98411c2e1c73b2cd12bbe35'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/18.jpg','Originalbild 18 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','f92e47adfd01272fbcb864701ddb1982f7c3641d9e0348a3f13d0ea3fad70176'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/19.jpg','Originalbild 19 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','280cab273b3e7e66db96ab29516a7a88f823baa9a04a750c71f77080dd741e96'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/20.jpg','Originalbild 20 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','e0e04fed1874b9d0b4da3e5bf5ff5a5f96ee87c3d8c3dadcd08f67b934adda15'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/21.jpg','Originalbild 21 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','dcdf36d891c764a808cca4415491cde9cb06b5beabbba7101007e9e36a28b5fe'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/22.jpg','Originalbild 22 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','de6c7333dc877d2411160b03379c1963fe8a0b69bac38b49cb3a7c6e2f2ab595'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/23.jpg','Originalbild 23 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','f044891fc26eb6150006b55f315a104cb08ef8a91c26fd02cdffa58cfc6e02b9'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/24.jpg','Originalbild 24 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','9a77f191ba312db8830d6bfc21c84c018649b8b6248ec357dbdc2ec7f32ac3d3'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/25.jpg','Originalbild 25 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','aba698cd628f9a64383c70f5b288e3bb9718f5fcafa5ce83d82e893cd3238edc'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/26.jpg','Originalbild 26 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','9da81051bab087182a92908514738d200d41e63074fe05c9f539b0d75298918e'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/27.jpg','Originalbild 27 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','f6276122f2c6e07cc6af8ca8b8ac1a80e180026bd0fa43317f54afb5564d68b6'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/28.jpg','Originalbild 28 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','ffcb805e4de0bea09c1f73569a61f00ea004bd2b199d35edf12a277412de1b0e'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/29.jpg','Originalbild 29 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','9a78fb962267163f37218a2320d43cc434cbfd6149a818f57919917f32697093'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/30.jpg','Originalbild 30 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','7171e404b3ae57af453a2bcf47e0aeb78c1bae7ba9e353953346cc4c9d9e207a'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-provider-media/der-koenigsleitner-romantik-zu-zweit/31.jpg','Originalbild 31 von Der Königsleitner - Romantik zu Zweit','Belegter Projekt-/Joomla-Medienbestand','0795f3d5dde34c369b11a4cebfd0cb586b86918ee7e44a7fc388f9d053d7c24a'),
('feldhof-dolcevita-resort','gallery','/reiseportal/unterkuenfte/feldhof-dolcevita-resort/01.jpg','Originalbild 1 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','103c73260f4db84b763a13406d5cfae8ff727b4d5cd25e6b4d3dd7d778a61be7'),
('feldhof-dolcevita-resort','gallery','/reiseportal/unterkuenfte/feldhof-dolcevita-resort/02.jpg','Originalbild 2 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','2e45e02e04c60c354d4bc224b84d967e1c4cd231a6a84ee1bb881b29ef733943'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-provider-media/feldhof-dolcevita-resort/03.jpg','Originalbild 3 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','59e8269748c5e8f859ec3b737987a3614c87bab7f0f271cb70b3256cb4140b39'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-provider-media/feldhof-dolcevita-resort/04.jpg','Originalbild 4 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','0d8d010af1a5cd21855f83df4b664512839c25d72877944c4603d5d1a37f1205'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-provider-media/feldhof-dolcevita-resort/05.jpg','Originalbild 5 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','93cc4b95b710619db5241fb346fd22fb69d8c3d8f2431b2b5fc30a1c724a5c8e'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-provider-media/feldhof-dolcevita-resort/06.jpg','Originalbild 6 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','38462d761ffcea6d8e19ee8fe7c67058a3f59510d4f872b660d4386292528b43'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-provider-media/feldhof-dolcevita-resort/07.png','Originalbild 7 von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','6181569e18ae1b7321f8614eed312bf6c61db8f59763ee8712b2adb9c4df52b7'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-provider-media/feldhof-dolcevita-resort/08.jpg','Belegtes ursprüngliches Anbieterfoto von FELDHOF DOLCEVITA RESORT','Belegter Projekt-/Joomla-Medienbestand','62d6b672f86fea76fc845f1f37bcdef31a1a8e05346fc1840deb12634c3d57eb'),
('ferienwohnung-sieber','gallery','/reiseportal/legacy-provider-media/ferienwohnung-sieber/01.jpg','Originalbild 1 von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','f8df9c64014c911e318ecdb1b6b32f63b703c3cd2e76456447fd87b1f1e419c3'),
('ferienwohnung-sieber','gallery','/reiseportal/legacy-provider-media/ferienwohnung-sieber/02.jpg','Originalbild 2 von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','f53672d0c74a7fcdf9e1e4f826471ac8a117c49eb755cd9591c17a2bb80c3dbd'),
('ferienwohnung-sieber','gallery','/reiseportal/unterkuenfte/ferienwohnung-sieber/01.jpg','Originalbild 3 von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','e5b54282231015337e4bf915d181b6083031390db57ecd5c213f1276a1109a5f'),
('ferienwohnung-sieber','gallery','/reiseportal/unterkuenfte/ferienwohnung-sieber/02.jpg','Originalbild 4 von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','c2bd95c106f0cb4847a1b571bd36a4646d6b6b094ec10f58402fd24d589fde61'),
('ferienwohnung-sieber','gallery','/reiseportal/legacy-provider-media/ferienwohnung-sieber/05.jpg','Originalbild 5 von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','ef188a0d5b851ff3a26ec6030c734231c47388f7f3c05adfd9716302e303f962'),
('ferienwohnung-sieber','gallery','/reiseportal/legacy-provider-media/ferienwohnung-sieber/06.jpg','Originalbild 6 von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','f85d8ed0ab136a08af4798a0963071061aa912fee524f27d5a5e295b4c191afc'),
('ferienwohnung-sieber','logo','/reiseportal/unterkuenfte/ferienwohnung-sieber/logo.jpg','Originales Anbieterlogo von Ferienwohnung Sieber','Belegter Projekt-/Joomla-Medienbestand','49934179ff57e0319ae73a5b54de8acc68ea62d8c90fd0e356276d94e78635f4'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/01.jpg','Originalbild 1 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','0fc5a166165009c3908f0c006e83aac02265ad18387b60df4bf402f283a0dbc0'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/02.jpg','Originalbild 2 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','45d9bb029cafb91799056e135c16d611c85f4f0f8c89bc2627028c82e337510d'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/03.jpg','Originalbild 3 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','257ed53c4097be0c0df28f7a3efde036e5302ed4669c01abd02456c522feabe3'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/04.jpg','Originalbild 4 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','b965d01d18e596c4368a2c0d662310c4e65f66a84593da8a9d15c93f4ed4ab96'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/05.jpg','Originalbild 5 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','5f92ee0a74452da91ec22626da72bb2497bc2512ace7b5f4a246f7a667100f96'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/06.jpg','Originalbild 6 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','f95d35374a6a1148ebd258a02946168fe313e9c5398547a02687cca418914fa5'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/07.jpg','Originalbild 7 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','c9f42df66f5cdd528cd68f15f31b5bc903501181ddf5f373649b61c64a942b22'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/08.jpg','Originalbild 8 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','c3935ae59c00661bc9342490011def0afbcf9c49a0c811a179c392aef8ea1828'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/09.png','Originalbild 9 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','d778110af7db747684f73db381017110810bf982496d118106a4f43dcc07603d'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/10.jpg','Originalbild 10 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','b1f1ea8d7175d3edee54e46105ed0fcdd32a811716804007f09fc61f7f62c95f'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/11.jpg','Originalbild 11 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','cb02f0a0f4fdf4ccdd7e5d525f2804371e0650a9b83d7d59f8ef8421d7729343'),
('golfhotel-andreus','gallery','/reiseportal/unterkuenfte/golfhotel-andreus/08.jpg','Originalbild 12 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','ce10cff6719b88564bc0cfa3eeef95a31bf9bfe43dd5f9105f0e051c1bcf86d3'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/13.jpg','Originalbild 13 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','4981215f991ffbc12ee0003fcddb65317ef215899d0802e317349660af8f2250'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/14.jpg','Originalbild 14 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','6f3de820523d6294190fa99ef65eb77fbe11bdd498669d3966b3a16805b018a3'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/15.jpg','Originalbild 15 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','5a2c4ecff8bde4eed3d428b365baab1d33a1a1c5eedd45daa5948eadb2afefbd'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/16.jpg','Originalbild 16 von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','626b75b544ae59646b74f30c3228d6a068cf4dc1f7ef3fde77e64e5c73d43147'),
('golfhotel-andreus','gallery','/reiseportal/legacy-provider-media/golfhotel-andreus/17.png','Belegtes ursprüngliches Anbieterfoto von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','5636628145eff0b54d3ae09d3f419119e0a16706a68ff5b8ec87b60353c0ef1c'),
('golfhotel-andreus','logo','/reiseportal/unterkuenfte/golfhotel-andreus/logo.jpg','Originales Anbieterlogo von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','Belegter Projekt-/Joomla-Medienbestand','e4b754c12cfb0c8e24028949fb504c431dbc50360aea53f5c3ae7832a7dad7ce'),
('hoeflehner','gallery','/reiseportal/unterkuenfte/hoeflehner/02.jpg','Originalbild 1 von Höflehner','Belegter Projekt-/Joomla-Medienbestand','b50518ee7aaf0daa6bd110b0f153b907817f027ab7c8ff6083e814a0ea670551'),
('hoeflehner','gallery','/reiseportal/legacy-provider-media/hoeflehner/02.jpg','Originalbild 2 von Höflehner','Belegter Projekt-/Joomla-Medienbestand','0193fc95cfd47e2a4eef00b122da234dc04ad7ad6903dcc94ebe1d00959344cc'),
('hoeflehner','gallery','/reiseportal/unterkuenfte/hoeflehner/01.jpg','Originalbild 3 von Höflehner','Belegter Projekt-/Joomla-Medienbestand','a19c1e2cde31e51ea692d238dd04a0599606c169b396b60763b948a652bb10fa'),
('hoeflehner','gallery','/reiseportal/legacy-provider-media/hoeflehner/04.jpg','Originalbild 4 von Höflehner','Belegter Projekt-/Joomla-Medienbestand','f35631e38849608c16b55935de7b91728f10ed1755c21ede38eecd87fd1f8c17'),
('hoeflehner','gallery','/reiseportal/unterkuenfte/hoeflehner/03.jpg','Originalbild 5 von Höflehner','Belegter Projekt-/Joomla-Medienbestand','b9ad78130a7e2ca0839d7832bb368610a130a31130ad87e7e940354d8e62c923'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/01.jpg','Originalbild 1 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','246aa07a20038a4cad29ad5b8d8361081a3830755005cc8aebeb94172c39ad8e'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/02.jpg','Originalbild 2 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','e64ee179dcf34b297f09fb9191498cf79e79c7e9662ca933f01cf57abc48452c'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/03.jpg','Originalbild 3 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','c28590b974282aa7c2613ca3e37df5062bb321a55156ecc73ec967adab4111af'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/04.jpg','Originalbild 4 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','64d5447170db7175906fc202370dcb0ad5a87de72b6cb7f9c1d876ec72449b6e'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/05.jpg','Originalbild 5 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','4f6c9abf6512bfd6a82243e3e1d61044797cf2745dde9380a51081268841441e'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/06.jpg','Originalbild 6 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','d16be9d245588c4644cdb2acd756491c40abf31db9fc7b2dd810a38263153c41'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/07.jpg','Originalbild 7 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','6dbbc66c3d08cabc177df5d700bf46c970df25e88ca7d038114cfd93ab3c55d1'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/08.jpg','Originalbild 8 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','d6dba6c83013dfc51bffd6018742cbed3bc3cb6b23f389f2e56137d030af8186'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/09.jpg','Originalbild 9 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','3b2b2d58020386321505b9bbc8750bb9edf434c95e0e3743a1ad286975d94e1e'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/10.jpg','Originalbild 10 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','03340916b3d06c6b4d2f535deb774670dc748bf41dccfc08f1c2c671d8c956fb'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/11.jpg','Originalbild 11 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','3c42ceea2baeaab923da96b73bc0792918623c029897c0a6efb2f07052ab5bd2'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/12.jpg','Originalbild 12 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','1d7e5d4a7b5e7419beeb98505c9dea48b9c3f7273dcdb5813f31ab678eb7b803'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/13.jpg','Originalbild 13 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','42604d58efd9b4f585c64be1315dde05a19c6962e088bc0714aff43f053afaf4'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/14.jpg','Originalbild 14 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','ccf52120b4c629083aa82b2babd93eda03519f1d3c116cb882dd00791e937426'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/unterkuenfte/hotel-ravelli-luxury-spa/01.jpg','Originalbild 15 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','4d91def33614cbd86ec6675178250e10e08504648551fad61e781cfa35afdf94'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/unterkuenfte/hotel-ravelli-luxury-spa/02.jpg','Originalbild 16 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','7fd21413de8afbbaa2a0a568948e35bf3732cbf2db12c289ac193b6654eb69a1'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/17.jpg','Originalbild 17 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','ebd8afa2867e19bff1d13d78a3a06b16191ab2d837ff54836195f55c3320cb29'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/18.jpg','Originalbild 18 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','31a062817bf7584836748868e108ae60a5eac8fb926923ca886559e0419f21a4'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/19.jpg','Originalbild 19 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','fd0a30b4be4b35fddecca093339cafbec766124d60c30a03c04cfee9a5f6e7ff'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/20.jpg','Originalbild 20 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','b62e7ede2b2b6e9daaf019da23ee6ad1618d264bc62c8dd4ab5cd6c3bd67d011'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/21.jpg','Originalbild 21 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','d2277c07a16b3b6dd81b2261bfd6aa5ca692a6cb728f787bfdd18c9cb840102c'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/22.jpg','Originalbild 22 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','de5df30a6923b45de91fd0153839aaeabefaac323afbf6a8a39b96b939670d75'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/23.jpg','Originalbild 23 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','36f3cdc2acc4aa1a13b21819aa1b2d7a12cc6de965b92b9273b34616e88d097d'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/24.jpg','Originalbild 24 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','e89cac621017d92900a396baf0aeadcda739c2f25d738aae5e0d7289086e93a3'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/25.jpg','Originalbild 25 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','e7d40b59ab02c38ec30273998cd8bc263656ed8aa3564538610ec9835cb78d91'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/26.jpg','Originalbild 26 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','818e49a968ce01677a91b3e6dde0676c1815f61fcbc39fd7fd2860c92707c11a'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/27.jpg','Originalbild 27 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','e8922df0061d44807eec27c8c04c77fb8cc71cbe25c88a0d12fba79f2589ac40'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/28.jpg','Originalbild 28 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','6ef4dc1b6593987ecd247aafa35c3609e42d8fd44afb673d255c7130edcab1c2'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/29.jpg','Originalbild 29 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','fe6c52b4081810c00c70549181cfc6aebf677a4ccc5dd7ed12ecc0f4eb083981'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/30.jpg','Originalbild 30 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','3df34d4400793c50d3e7dcf6a64027cfb2226cef876fbd82675ede5b7ee6876a'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/31.jpg','Originalbild 31 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','ab7a2fdfa1f125dbd9a53e515013b39c1256af21aa681b921353bbf7ec0b7e91'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/32.jpg','Originalbild 32 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','5bd2e11239e44e80a067e495ce9c40adf566b531347ebcbd861aa7a900c2a2fd'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-provider-media/hotel-ravelli-luxury-spa/33.jpg','Originalbild 33 von Hotel Ravelli Luxury Spa','Belegter Projekt-/Joomla-Medienbestand','211c66d756376c836666e88aed6a4786de7d4990b14bc38d338ff9d3878092a7'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/01.jpg','Originalbild 1 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','6222e080984cacb3e47418e11f9ed45af6e13d43e8da77e09d1ff73c51169d8f'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/02.jpg','Originalbild 2 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','a64d50d627baba508379b99831e59f27520a42c5d48cf486bbdc4ce3802788b5'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/03.jpg','Originalbild 3 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','eea3919fb2a4a5c5a357f1df3184499065bbce92d8a23808057cbff41462f914'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/04.jpg','Originalbild 4 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','f434dddcf03281e7b2403d86d64d63b9ec734ba01bb5b0c63ad11efff709575b'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/05.jpg','Originalbild 5 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','c524da32057eb920355547dc67ac8bdc65bb207f8cf71231b47f36caf74edb9a'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/06.jpg','Originalbild 6 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','2dba0d782d93f45de2fb6e557e564fd5a1d793435215e6290c3cdf19f6289772'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/07.jpg','Originalbild 7 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','2d439dd1ec50b6bf1fa67ec732ffd5bb4de588f41c3347ef687b0fbc22f68a89'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/08.jpg','Originalbild 8 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','1380530818097db0ca906f0d261c6cf20535adfe86d31cda33a061635a4136ca'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/09.jpg','Originalbild 9 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','36852979136d71e69017adea8cd6ef701ffb2a85345b46a9f358948d6ae58f43'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/10.jpg','Originalbild 10 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','dc06a23ebc8b480f4e2a2fa53baf98d651285a15d081e9cd54403cc1100d40a5'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/11.jpg','Originalbild 11 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','9896f82177a09a5b42a19187e3098cd0a95c43cddd6386041a193f0b2bf36b8e'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/12.jpg','Originalbild 12 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','a5ce6b320573622df196d4c2f9a30d608fe4ad3915c785b1e1c3a7be51c83b8f'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/13.jpg','Originalbild 13 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','c4423e194a956209819586c85886dcda268209359b267151cc5657b792696bf3'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/14.png','Originalbild 14 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','8cdd0017832cb85b78d100f8e0829f1913eb48829dc9abb6363ed00358b9a64c'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/15.jpg','Originalbild 15 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','36bd378eb8d5ba48fcd559d06911b71e30a72cf2fb7d758defef93b9e5359179'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/16.jpg','Originalbild 16 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','ac9c9bf225f9d07a598eae1a2d0255779c0c72bb529a5bbfd60653e29df4adaa'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/17.jpg','Originalbild 17 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','d8a5a101c6d0972c6f5eaf701701c38a285e9a5e95d5f2ee9f574ddc18d31633'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/18.jpg','Originalbild 18 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','1df37dee040a13805b964621d6c6108c1919d31cf4de947c808b376e77666aaa'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/19.jpg','Originalbild 19 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','0bffb77f6a55234ad5e366cc763890daaacf271cd0237839726a8f990c229b6e'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/21.jpg','Originalbild 20 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','1f3a1ae4b0405f64db6afb6e405ae95836be3c18305f2286bc3183921daba7ed'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/22.jpg','Originalbild 21 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','ef945ba0c03a921f371d42f8f8b05dfce6e302b6cbce005f0fa9c699b19261fe'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/23.jpg','Originalbild 22 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','f504b236e1ca4df29153837788804073d8e035cb67952df40d999f19e3553e57'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/24.jpg','Originalbild 23 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','32029c09ce6bdfd35690e91c18295282a9b7eee31129b9892236756a32319b43'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/25.jpg','Originalbild 24 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','7ab20d543b2fb52c5667c68d31fdb0f2f82769d036f77ca412d065afb8d1eabd'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/26.jpg','Originalbild 25 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','fe4f207b03c835d0d6f9d67710fbd8b03514c2d671996ffd690e5fd0b7d7bdd3'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/27.jpg','Originalbild 26 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','659733bb4a9615c9e8318b0cc2fdcf5cf4c583eaef72639269f6efab859e3844'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/28.jpg','Originalbild 27 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','3abbbe64162b7070e303a33f40b595d888646bc763b27a920ee81a6a06e809cc'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/29.jpg','Originalbild 28 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','9ec977aad25b355a083158b3c7af4be050bfe006378349c775bb98a8aa341625'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/30.jpg','Originalbild 29 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','c373bcbb66815413411e4ce245168acac56bca6b7086d62a690705b004f75190'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/31.jpg','Originalbild 30 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','0e3219bc3d8eb0a158d8f766e1561927e1b8323b76c5238ec0dd62477ffe16c5'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/32.jpg','Originalbild 31 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','82ed265efd832310c7d895218e822fd243c637a43e87f8b791bea9146e6496d1'),
('hotel-salzburger-hof','gallery','/reiseportal/legacy-provider-media/hotel-salzburger-hof/33.jpg','Originalbild 32 von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','eeeb1c951f5e6b377b8086e5cebe45d483078a158a28c2ef49e299869830f23f'),
('hotel-salzburger-hof','logo','/reiseportal/legacy-directory/hotel-salzburger-hof.jpg','Originales Anbieterlogo von Hotel Salzburger Hof - Familienurlaub','Belegter Projekt-/Joomla-Medienbestand','aa0f4689fe53016ab2954e255a8a8ec59cb873379eee8d528945522e572b98ce'),
('hotel-zur-post','gallery','/reiseportal/legacy-provider-media/hotel-zur-post/01.png','Originalbild 1 von Hotel zur Post','Belegter Projekt-/Joomla-Medienbestand','740591ae56ce29e87a34c49c8e71298e7158190e7417ec247be043ae96135c34'),
('hotel-zur-post','gallery','/reiseportal/legacy-provider-media/hotel-zur-post/02.png','Originalbild 2 von Hotel zur Post','Belegter Projekt-/Joomla-Medienbestand','37d2662cc15d49e7502086072744255f04a7949912ad40e390648aeffa098ecf'),
('hotel-zur-post','gallery','/reiseportal/legacy-provider-media/hotel-zur-post/03.png','Originalbild 3 von Hotel zur Post','Belegter Projekt-/Joomla-Medienbestand','29d29b1fda1ef22a71b48408f4a8abb0d460faa365a666305261f094e9d6a2cd'),
('hotel-zur-post','gallery','/reiseportal/legacy-provider-media/hotel-zur-post/04.png','Originalbild 4 von Hotel zur Post','Belegter Projekt-/Joomla-Medienbestand','b39611b20541b4e3106838d04a53816c064a6a29555ef3da4a059626b1406865'),
('hotel-zur-post','gallery','/reiseportal/unterkuenfte/hotel-zur-post/logo.png','Originalbild 5 von Hotel zur Post','Belegter Projekt-/Joomla-Medienbestand','2bcdba2b34a7d5b1c8c0203eceae49da753b42e064249fa1c4ca49f438244e40'),
('hotel-zur-post','gallery','/reiseportal/unterkuenfte/hotel-zur-post/01.png','Belegtes ursprüngliches Anbieterfoto von Hotel zur Post','Belegter Projekt-/Joomla-Medienbestand','09684db04a9ba7f3140fcfd747a330b4efb5b014cb2c58ce38aa4214f502ccfb'),
('jaegeralpe','gallery','/reiseportal/legacy-provider-media/jaegeralpe/01.jpg','Originalbild 1 von Jägeralpe','Belegter Projekt-/Joomla-Medienbestand','59e1c9d7fc3781657d70a5fa5a83a3c26a6b5c7422c586dada2ee1596dfa2fcb'),
('jaegeralpe','gallery','/reiseportal/legacy-provider-media/jaegeralpe/02.jpg','Originalbild 2 von Jägeralpe','Belegter Projekt-/Joomla-Medienbestand','990f80597db01097490af87b928ec60f5f2ce72ab54393a723b9a349e8d30faa'),
('jaegeralpe','gallery','/reiseportal/legacy-provider-media/jaegeralpe/03.jpg','Originalbild 3 von Jägeralpe','Belegter Projekt-/Joomla-Medienbestand','f50c204455f53d2a5894f8015cfe10a23614cd78a36e5c54a15b0a9a98d90ae5'),
('jaegeralpe','gallery','/reiseportal/legacy-provider-media/jaegeralpe/04.jpg','Originalbild 4 von Jägeralpe','Belegter Projekt-/Joomla-Medienbestand','a99412299ad762d069638cd7e8940d443aed9db2e01bb3f20cb132e429e2a939'),
('jaegeralpe','gallery','/reiseportal/legacy-directory/jaegeralpe.jpg','Originalbild 5 von Jägeralpe','Belegter Projekt-/Joomla-Medienbestand','ef73251574c3fac8316541be67d7cb0450325191d1d98a19985d1e28bc0c2494'),
('kemmeriboden-bad','gallery','/reiseportal/legacy-directory/kemmeriboden-bad.jpg','Originalbild 1 von Kemmeriboden-Bad','Belegter Projekt-/Joomla-Medienbestand','9bb3b19f210bd2fb836dc3cef81e9ec5f812db135fb60d451da67c19e9aa548f'),
('kemmeriboden-bad','gallery','/reiseportal/legacy-provider-media/kemmeriboden-bad/02.jpg','Originalbild 2 von Kemmeriboden-Bad','Belegter Projekt-/Joomla-Medienbestand','8e2839ee0f622c67164779b230870b6084e8749529cc68fa2f9d353bc914b2ff'),
('kemmeriboden-bad','gallery','/reiseportal/legacy-provider-media/kemmeriboden-bad/03.jpg','Originalbild 3 von Kemmeriboden-Bad','Belegter Projekt-/Joomla-Medienbestand','b4a2eca621ee26675fb9c2167108738b38ca06611979f0e9da7c0056f953fd38'),
('kemmeriboden-bad','gallery','/reiseportal/legacy-provider-media/kemmeriboden-bad/04.jpg','Originalbild 4 von Kemmeriboden-Bad','Belegter Projekt-/Joomla-Medienbestand','3c670a945bad3e7983d30b912169a1a1932125ac09b2c31fff36947a323bcc34'),
('kemmeriboden-bad','gallery','/reiseportal/legacy-provider-media/kemmeriboden-bad/05.jpg','Originalbild 5 von Kemmeriboden-Bad','Belegter Projekt-/Joomla-Medienbestand','ef53c8ccd9fe3733fc6d0659b7b0dee75836a8edad4abee68ad930be13c31fc0'),
('kemmeriboden-bad','gallery','/reiseportal/legacy-provider-media/kemmeriboden-bad/06.jpg','Belegtes ursprüngliches Anbieterfoto von Kemmeriboden-Bad','Belegter Projekt-/Joomla-Medienbestand','ec4d0808797614ae66f75bc6c1b79fc8e4ad085dc19db1b28bb350f8d3507b12'),
('landgasthof-neue-schaenke','gallery','/reiseportal/unterkuenfte/landgasthof-neue-schaenke/02.jpg','Originalbild 1 von Landgasthof "Neue Schänke"','Belegter Projekt-/Joomla-Medienbestand','2100fa2aa7a52d45be46a3aef002a574edda86d55d9abf84e75012f70faf609f'),
('landgasthof-neue-schaenke','gallery','/reiseportal/legacy-provider-media/landgasthof-neue-schaenke/03.jpg','Originalbild 2 von Landgasthof "Neue Schänke"','Belegter Projekt-/Joomla-Medienbestand','28358f30e3eff80f0981cf20c0c294e6f157b972ae5f11a1b3cf8a1577a6501e'),
('landgasthof-neue-schaenke','gallery','/reiseportal/unterkuenfte/landgasthof-neue-schaenke/01.jpg','Belegtes ursprüngliches Anbieterfoto von Landgasthof "Neue Schänke"','Belegter Projekt-/Joomla-Medienbestand','583d4bba9f5bed6dd0e74b20f2c3e72e33fe4ff247ab5090838993ed4afe95d6'),
('landgasthof-neue-schaenke','logo','/reiseportal/unterkuenfte/landgasthof-neue-schaenke/logo.png','Originales Anbieterlogo von Landgasthof "Neue Schänke"','Belegter Projekt-/Joomla-Medienbestand','6e4e2502295a6f65b5c2eb840b6002fba6b1ee13348ff9dc4550f23582ef36af'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/01.jpg','Originalbild 1 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','1b67f97d3b548fbf12867a1bcf2ab767a3e5b5683f058cc1889a9b8d012a907b'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/02.png','Originalbild 2 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','145a0c4b9804062a0334f40524f39dd92ead3d752db8b9479247b4abea3ffc07'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/03.jpg','Originalbild 3 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','33b469bbe4f7fbc99accdf3e2868c1015de681d97509b626c22452ed2c26aa01'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/04.jpg','Originalbild 4 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','0ce6d032e7ef9d0ef3b80730b056cc1d34a71c58afff3740725ff0dfc47490b5'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/05.jpg','Originalbild 5 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','9f6ef96e79cdc91071745ab1415e2aa7e718c9d4460b8621af706d2d61c99e7a'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/06.jpg','Originalbild 6 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','4442bb66e3a59b5ef43f01ba6048207b56bb02f25bd670f85108d3980abf014c'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/07.jpg','Originalbild 7 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','571b54dd09edec59b3ffd80cebab63ff8613420f3a44292edd07454ab6da7608'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/08.jpg','Originalbild 8 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','26e7bea15f732c5443b5a0a53a7d7fd1790dc0e744ff25f086aca2cfdbbca6fa'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/09.png','Originalbild 9 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','dc7798d51ee8cf1d4a645ffe64c3f153284df5db1b723a00020ac6029a5938ff'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/10.jpg','Originalbild 10 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','4b1db2aec1176141545cba45f545bd33e93cec276759f8375942527395acfa9b'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/11.jpg','Originalbild 11 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','5ff4ce03acd8bdf7002dd839b33e875ff58dd356aba3c6f9e635abfd25993258'),
('ostsee-barfusspark','gallery','/reiseportal/unterkuenfte/ostsee-barfusspark/01.jpg','Originalbild 12 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','7e8d5d10381a63d74e54d4cbacb6dfff6e93809f304ab5822f10c8089ac29c8b'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/13.jpg','Originalbild 13 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','2d743152ec9a75fbda6b7308f31800d9d88c44aa84165eb3dfea5f36b91e82ad'),
('ostsee-barfusspark','gallery','/reiseportal/unterkuenfte/ostsee-barfusspark/02.jpg','Originalbild 14 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','0f7daf247b6611b17014156207f090c66d819facd43934be6c3b953e90d51920'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/15.jpg','Originalbild 15 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','0755aaefe9015e45d5da4208ba48e64e0e6f7686375c444693c35baaf41b7224'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/16.jpg','Originalbild 16 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','c7edd5a9bb2671fb5e650b7d88eee8ee9abc567db841d32913f26a4558500bdb'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/17.jpg','Originalbild 17 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','7904b4fbd8c0e84ab3cdf996f0a3b09cf2be2577340b05356be85c6be7a97b97'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/18.jpg','Originalbild 18 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','54c45b6dfcfd231f4726a687abfdecaa1b2e324ce6ebc2dcc74bb8132938cfa0'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/19.jpg','Originalbild 19 von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','cffdcccbe4b1a136a33732362fd227467668afbf4065fb9d5b03d7f7ad77f999'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-provider-media/ostsee-barfusspark/20.jpg','Belegtes ursprüngliches Anbieterfoto von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','dd62fff65d69655732c9a9d8023b767574b8c36859e8500875ace0e83cb1279d'),
('ostsee-barfusspark','logo','/reiseportal/unterkuenfte/ostsee-barfusspark/logo.jpg','Originales Anbieterlogo von OSTSEE - BARFUSSpark','Belegter Projekt-/Joomla-Medienbestand','e383d3221769d44855e080a9a0023ee119cf9300e8ffbe2a940208e243be7377'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/unterkuenfte/oversum-vital-resort-im-hochsauerland/02.jpg','Originalbild 1 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','42ddce1252fbff47a8955f02510eae6fad55525d38d762118478271121868b5e'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/02.jpg','Originalbild 2 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','4fd933d808d0eb1740b349500a823c8ccdbb0a6859f0b3242d6f861aa1848997'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/03.jpg','Originalbild 3 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','f9fc956c46d60ce6fb3474088ceca7d98c724c93e517c58f3fdeeeb9ed595e6c'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/04.jpg','Originalbild 4 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','86458bc867b4c14423a5793ee6870bd1f18cfb33a50e1ed80fa126420ceb591a'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/unterkuenfte/oversum-vital-resort-im-hochsauerland/01.jpg','Originalbild 5 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','85ebbf3a1579a536d7909828b428bb699c57f82c823fefa0ada7ed3ea8d88927'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/06.jpg','Originalbild 6 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','8f903c4e6f1f2db78d6413b7cca8069e7cfc2d432a3add7950f5ed5f99d7cd4e'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/07.jpg','Originalbild 7 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','3dc3ba0d127c57ee63bced0616fdbab0a00fdc003d9318b24fc313bdf6f03dea'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/08.jpg','Originalbild 8 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','49f4fd6d7ff5d60572e7e37c841b75bfc458a17076287c3d6fa94e0937cb1c8f'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/09.jpg','Originalbild 9 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','0fb2dd206f075f0276279ff9ab707ea5d04505abab3210e256a18bd9c20b356e'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/unterkuenfte/oversum-vital-resort-im-hochsauerland/logo.png','Originalbild 10 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','85ee13db08b378c60dbdf120485438f4119f92783048ea5dbef98e243883fe04'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/11.jpg','Originalbild 11 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','a21d32a6cea175b9b7980ec79e66c4046b8aa05df40855a0729ac346b626d4f8'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/12.jpg','Originalbild 12 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','2930dfa34c24f22f11cdc18885d695af01a8563078c9bf1eccd66b7d2f6873d2'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/13.jpg','Originalbild 13 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','a53eebfd46a4fa1b459247ef09b0c9402392c9a4c540c72120b250d3b2db5ca7'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/14.jpg','Originalbild 14 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','ea43854948cab2554621c0396f1ed19546a1b76ace26c77f0b150b4bcf381f02'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/15.jpg','Originalbild 15 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','82b719516e4ec3dae2f501e376bde0389dbe0deadd82f521bb97d30c735ddc89'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/16.jpg','Originalbild 16 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','1a7f926e045653bdfab52541f5e7a52b8cd3ff0375670e60608b093373b4662f'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/17.jpg','Originalbild 17 von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','f2d12945d2a5375a953793dadd55ddcc935d4e5cc8260c9d22f8d287e28890af'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-provider-media/oversum-vital-resort-im-hochsauerland/18.jpg','Belegtes ursprüngliches Anbieterfoto von OVERSUM Vital Resort im Hochsauerland','Belegter Projekt-/Joomla-Medienbestand','ccad8e053c7b62532113694e1432590f63d96c05b2ffda0d42a28285190d65d9'),
('pension-sonnenhof','gallery','/reiseportal/legacy-provider-media/pension-sonnenhof/01.jpg','Originalbild 1 von Pension Sonnenhof','Belegter Projekt-/Joomla-Medienbestand','a3b8a595cb56a67104d1ed7c9fa81f3352c3a7ba839c0f7de1a6e1f70527faf1'),
('pension-sonnenhof','gallery','/reiseportal/unterkuenfte/pension-sonnenhof/01.jpg','Originalbild 2 von Pension Sonnenhof','Belegter Projekt-/Joomla-Medienbestand','124a2281c499d70a3cb42dd3f501e61641bc413e59efa70b19612d67bfd668c7'),
('pension-sonnenhof','gallery','/reiseportal/unterkuenfte/pension-sonnenhof/02.jpg','Originalbild 3 von Pension Sonnenhof','Belegter Projekt-/Joomla-Medienbestand','066fc86e3924b58227f85e798a103c92eb6bd9f6874b1700e00fec14dda9e168'),
('pension-sonnenhof','gallery','/reiseportal/unterkuenfte/pension-sonnenhof/03.jpg','Originalbild 4 von Pension Sonnenhof','Belegter Projekt-/Joomla-Medienbestand','e42cc47e68d300db7f38ac007a1b520614b14eda586f239d533b09bf4b3f2095'),
('pension-sonnenhof','gallery','/reiseportal/legacy-provider-media/pension-sonnenhof/05.jpg','Originalbild 5 von Pension Sonnenhof','Belegter Projekt-/Joomla-Medienbestand','1d783ad97b6633088e3665cbd3e197d299b214c96dfc3222293cbd34ed7a8ae1'),
('platzl-hotel','gallery','/reiseportal/legacy-provider-media/platzl-hotel/01.png','Originalbild 1 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','4dc038dcaff9e994a1a1f8ccc5a6f6ab68c786000f97a443282d733a9331c514'),
('platzl-hotel','gallery','/reiseportal/legacy-provider-media/platzl-hotel/02.png','Originalbild 2 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','8c46249af4950eaa3ae3a9b7c288be7717626f3fe5febbc638f4bb1f15fa03ae'),
('platzl-hotel','gallery','/reiseportal/legacy-provider-media/platzl-hotel/03.png','Originalbild 3 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','51f75070584cb3fbc7a7c0492243b9b76eedf14addf0ac885ec5efb98b76ed45'),
('platzl-hotel','gallery','/reiseportal/legacy-provider-media/platzl-hotel/04.png','Originalbild 4 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','70d7ec0a1d22be3c2c4bf44441481dd05e8bf299f6e9f50c422cbcda878d6708'),
('platzl-hotel','gallery','/reiseportal/legacy-provider-media/platzl-hotel/05.png','Originalbild 5 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','aad03f76705c41dc9a93be22fda9fd038047dc7a52c58edcfc0f782969704e49'),
('platzl-hotel','gallery','/reiseportal/unterkuenfte/platzl-hotel/01.png','Originalbild 6 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','9859a124cf9758f62b12ea83cfc5f9df781752d8a20951e96c7df39d68ba90ee'),
('platzl-hotel','gallery','/reiseportal/unterkuenfte/platzl-hotel/02.png','Originalbild 7 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','50cc78892c24b22d5ab830836811d10f5e8f11fd0baf51c9ca82d5f3af47669b'),
('platzl-hotel','gallery','/reiseportal/unterkuenfte/platzl-hotel/logo.png','Originalbild 8 von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','7c41f4e798ea6ef7348657e07256142cbd899fb8c9d8c5db0664f644231aac07'),
('platzl-hotel','gallery','/reiseportal/legacy-provider-media/platzl-hotel/09.png','Belegtes ursprüngliches Anbieterfoto von Platzl Hotel','Belegter Projekt-/Joomla-Medienbestand','fdd1a6407b1e025fd4ac34808c726506e9567c7e631307d4552a3160b8f27502'),
('rue-blanch','gallery','/reiseportal/unterkuenfte/rue-blanch/01.jpg','Originalbild 1 von Rü Blanch','Belegter Projekt-/Joomla-Medienbestand','c6eccfb1684e5c62aea090a484c7a14d4b11814d29ad53ae33e8b338ef8c6894'),
('rue-blanch','gallery','/reiseportal/unterkuenfte/rue-blanch/02.jpg','Originalbild 2 von Rü Blanch','Belegter Projekt-/Joomla-Medienbestand','2b3ed5ad8a1eee4770ceb3a4e00026e3b74e43e34d48487e7f94172737043150'),
('rue-blanch','gallery','/reiseportal/legacy-provider-media/rue-blanch/03.jpg','Originalbild 3 von Rü Blanch','Belegter Projekt-/Joomla-Medienbestand','a6316fb74d00fa58e47c69941fb9fad1e4edd5ffe724dea83cbda70a5b7ea2b3'),
('rue-blanch','gallery','/reiseportal/legacy-provider-media/rue-blanch/04.jpg','Originalbild 4 von Rü Blanch','Belegter Projekt-/Joomla-Medienbestand','d576ddea94b2136e9c9980c17fcef389ab09da7d4973d7f2119e8dd7bda09b1a'),
('rue-blanch','gallery','/reiseportal/legacy-provider-media/rue-blanch/05.jpg','Belegtes ursprüngliches Anbieterfoto von Rü Blanch','Belegter Projekt-/Joomla-Medienbestand','a750745ba883c690573fb582768f3321fcff491107cd5159aa125029e6dd8aef'),
('schafhuber','gallery','/reiseportal/unterkuenfte/schafhuber/01.jpg','Originalbild 1 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','77953878a997df44c84aa29788b841d235d44384e736509f3101a313fb473ac0'),
('schafhuber','gallery','/reiseportal/unterkuenfte/schafhuber/02.jpg','Originalbild 2 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','5897f1883342ffea2e729b68b2c41d29a414f66aaae2da945739b0ae507017f8'),
('schafhuber','gallery','/reiseportal/unterkuenfte/schafhuber/03.jpg','Originalbild 3 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','5234697b0b3fd05749ecaf7d0e1f41b24c7841298c92ae8bda0c0a2417d7d480'),
('schafhuber','gallery','/reiseportal/unterkuenfte/schafhuber/04.jpg','Originalbild 4 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','e228b9d37e5f8050352b52b1818ff9429fb11015fe0de791339f53da55b71fbb'),
('schafhuber','gallery','/reiseportal/legacy-provider-media/schafhuber/05.jpg','Originalbild 5 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','8acbd6ce7be204d14e6a67c0bc44dd30f053e0bdcce5265ee451225a91822752'),
('schafhuber','gallery','/reiseportal/legacy-provider-media/schafhuber/06.jpg','Originalbild 6 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','9fe8a73c55ea156e5f26b9ca983dd1e14685b9da547b8d434ebc0b9b5530c277'),
('schafhuber','gallery','/reiseportal/legacy-provider-media/schafhuber/07.jpg','Originalbild 7 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','9f037151a52e2998cae010846b5fc3aa4e044db5628c3637e457cf03d704bd4e'),
('schafhuber','gallery','/reiseportal/legacy-provider-media/schafhuber/08.jpg','Originalbild 8 von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','6f55afe5b5c4b9ad1556ddd64a469af9d25811901557d521bd2575e821652e0c'),
('schafhuber','gallery','/reiseportal/legacy-provider-media/schafhuber/09.jpg','Belegtes ursprüngliches Anbieterfoto von Schafhuber','Belegter Projekt-/Joomla-Medienbestand','887dcaa9f8498db21777f57fdc03ef8f2d53c575167b37c00228d4e998d69068'),
('schwarzwaelderhof','gallery','/reiseportal/legacy-provider-media/schwarzwaelderhof/01.jpg','Originalbild 1 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','2e3ec2c09c1b8cfb3674cceafd0e98ef8ae1835d47066741291890ca27d8b17d'),
('schwarzwaelderhof','gallery','/reiseportal/legacy-provider-media/schwarzwaelderhof/02.jpg','Originalbild 2 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','677ce98e185222ea5a5b7752880b5bd53946dc019e72a75ba3b7ae533cf43fd1'),
('schwarzwaelderhof','gallery','/reiseportal/unterkuenfte/schwarzwaelderhof/01.jpg','Originalbild 3 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','bf8616eb0e1079b442527e7ae08bedeeb074ffe2e12d53f372aad03fb2c1c788'),
('schwarzwaelderhof','gallery','/reiseportal/legacy-provider-media/schwarzwaelderhof/04.jpg','Originalbild 4 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','d755abc756d065596185582795e3470dfb051668e7816f4bdbf47066351f56fe'),
('schwarzwaelderhof','gallery','/reiseportal/unterkuenfte/schwarzwaelderhof/02.jpg','Originalbild 5 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','9331a956c4127ac7856ef72be196970f94b85d03df3af5c4e46180b1b53d7551'),
('schwarzwaelderhof','gallery','/reiseportal/unterkuenfte/schwarzwaelderhof/logo.png','Originalbild 6 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','775d8e13e386c780e9076df9ad668f72aa0dc214ce459ee442e3c8da6900f23e'),
('schwarzwaelderhof','gallery','/reiseportal/legacy-provider-media/schwarzwaelderhof/07.jpg','Originalbild 7 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','440b6b459772b3aeb9f4c18947be6afe17856ef87f4edaeffd7822eef3e0a390'),
('schwarzwaelderhof','gallery','/reiseportal/legacy-provider-media/schwarzwaelderhof/08.jpg','Originalbild 8 von Schwarzwälderhof','Belegter Projekt-/Joomla-Medienbestand','13f9bf05729cfc280d698ee53297eb7823787b09ef543b50ee946b36a625e10c'),
('sub-aqua-tauchreisen','gallery','/reiseportal/legacy-provider-media/sub-aqua-tauchreisen/01.jpg','Originalbild 1 von SUB Aqua Tauchreisen','Belegter Projekt-/Joomla-Medienbestand','531d7237ccfe38b3471ee9b11419479517f5f5eaac027220d6859fb4dd79376e'),
('sub-aqua-tauchreisen','gallery','/reiseportal/legacy-provider-media/sub-aqua-tauchreisen/02.jpg','Originalbild 2 von SUB Aqua Tauchreisen','Belegter Projekt-/Joomla-Medienbestand','4ac7a65a31edc163f175898656b5a96c3d64943022a263e0428a4ff17f22c1a6'),
('sub-aqua-tauchreisen','gallery','/reiseportal/legacy-provider-media/sub-aqua-tauchreisen/03.jpg','Originalbild 3 von SUB Aqua Tauchreisen','Belegter Projekt-/Joomla-Medienbestand','f4fddd2c8b9da00439dc1c81d32b1083cd837d0565d498192fe9a2d959143ffd'),
('sub-aqua-tauchreisen','gallery','/reiseportal/unterkuenfte/sub-aqua-tauchreisen/logo.png','Originalbild 4 von SUB Aqua Tauchreisen','Belegter Projekt-/Joomla-Medienbestand','9eff54b9dd5d4e125e63591624090001c45ffffc73da773989ee7640693f9df7'),
('the-chedi','gallery','/reiseportal/legacy-provider-media/the-chedi/01.jpg','Originalbild 1 von The Chedi','Belegter Projekt-/Joomla-Medienbestand','5b73cc6f657f7b736e3c4452e09ddcda0664238c9170a892dd2d5085f7192653'),
('the-chedi','gallery','/reiseportal/legacy-provider-media/the-chedi/02.jpg','Originalbild 2 von The Chedi','Belegter Projekt-/Joomla-Medienbestand','3f1064b74b783ba28c1c3baf6a604187c5abfd639fc3ea0558396596cca80b13'),
('the-chedi','gallery','/reiseportal/legacy-provider-media/the-chedi/03.jpg','Originalbild 3 von The Chedi','Belegter Projekt-/Joomla-Medienbestand','f6f53abf9dc41e2a7aac2011f0b81c881a6a6095829ef6d3125f197118392d54'),
('the-chedi','gallery','/reiseportal/legacy-provider-media/the-chedi/04.jpg','Originalbild 4 von The Chedi','Belegter Projekt-/Joomla-Medienbestand','cb6ec1fa83bebc1dcc4ab41449cf61ddf8d3445deac9a79f08b1da79bc055823'),
('the-chedi','gallery','/reiseportal/unterkuenfte/the-chedi/logo.png','Originalbild 5 von The Chedi','Belegter Projekt-/Joomla-Medienbestand','5ced7d8463928de642444aa5e31f4d2da454a11073b0f434c04f27e1fae62e41'),
('the-chedi','gallery','/reiseportal/legacy-provider-media/the-chedi/06.jpg','Originalbild 6 von The Chedi','Belegter Projekt-/Joomla-Medienbestand','40e12e9cf1b1dfb23236f9663f3ef5cd4b25b9137c1c7ce51bd27db56361e8a2'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/01.png','Originalbild 1 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','233e9ae98df55f266ef76be8fad798ce98561964d3cf8fed97c06194d881bcce'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/02.jpg','Originalbild 2 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','c91136dca40cf0610166c6de9323f7bcf7013de86a12043c93ec89dbb2712ed8'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/03.jpg','Originalbild 3 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','120a5d0b127da68b23b3fc9d98ec757e46c3a405f9c2af1274703ddab9b8fe31'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/04.jpg','Originalbild 4 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','32add8f72f8d2562fd5b9ed3b7d04c34abe8b8de0d31120ad2019049ee8e9e5f'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/05.jpg','Originalbild 5 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','798f358599d30e86d4e730423ab9bba246622750ffa9dc8f44b425ababeb3079'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/06.jpg','Originalbild 6 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','b6caab191c4f43a5baa3cba97c6f0683e945a6f7364a3367acf846ba73f6e262'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/07.jpg','Originalbild 7 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','6f4adcbc3bd549190c31b1fcd2edd98db42637e2d5bd77c912ee729a47355e99'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/08.jpg','Originalbild 8 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','e7bcf6e7a9232ade36033ce69217bc072a0d70b8bce9608e0d96ff9a414e34ca'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/09.jpg','Originalbild 9 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','a4e556833b62967d5b53fa46b1d53f84b3432d299713b808af3d859fb5a63a60'),
('urlaub-auf-borkum','gallery','/reiseportal/unterkuenfte/urlaub-auf-borkum/02.jpg','Originalbild 10 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','b850e0b0dd081a2e456f8ccea65b26fac213ac75354559914aa7c9d84d4fa51c'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/11.jpg','Originalbild 11 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','529f8468de29b4101bc91b226cf6f1a4570c1b967bbd57796e6d325be479d5ba'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/12.jpg','Originalbild 12 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','6dee8faa5b86f153faeb0663bd5528a79d46c0a49893089c5eb1a3dd90b005b9'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/13.jpg','Originalbild 13 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','36a90c50ba25dd358feee9eece9cca6aba1c8507057d6dfc6ea94512e8695cd2'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/14.png','Originalbild 14 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','1e789187571022e119be6d40293f73a8975b7ee6b52f37e998b8ae0db8ce2698'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/15.jpg','Originalbild 15 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','fd11db6d8241309c7fa0551179e0fceacfa936b6f3c5bc0401a5bc5d32f58464'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/16.jpg','Originalbild 16 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','c4d5f830b6b5a52b8da434439f7973ea31a543c244742e85b006f85d48a1186c'),
('urlaub-auf-borkum','gallery','/reiseportal/unterkuenfte/urlaub-auf-borkum/01.jpg','Originalbild 17 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','9bb82c614d2b49dab0f22213e577c588f5fe290189818a0dff702b7e891e46d7'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/18.jpg','Originalbild 18 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','52e6f7967ba77c2fb4cc3b3a174fc03d33998fd92f2f1f0ace2360f531209e18'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/19.jpg','Originalbild 19 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','bef185a2902e5e648a15f4b1903484d02878d119bc2ecf130774082596714d2b'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/20.jpg','Originalbild 20 von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','fc7675124373b2bd41c21fd4018ff5e9cd98eada6537aed736ba6d7cb86b3080'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-provider-media/urlaub-auf-borkum/21.jpg','Belegtes ursprüngliches Anbieterfoto von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','2a4466e91653406f689f483968df55b4d6c28057e58b5a9a90fd934ab1bb533e'),
('urlaub-auf-borkum','logo','/reiseportal/unterkuenfte/urlaub-auf-borkum/logo.jpg','Originales Anbieterlogo von Urlaub auf Borkum','Belegter Projekt-/Joomla-Medienbestand','aa64a1c837a10f2fbbc843ec5ad2cf0edbb29a4bd8d194e59a6d4b708b24a2a0'),
('wellnesshotel-almhof-call','gallery','/reiseportal/unterkuenfte/wellnesshotel-almhof-call/01.jpg','Originalbild 1 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','10ac5b79730d59e276432f33551bfcf850cfc3d84c2972a3acffdde728c4c6cf'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/02.jpg','Originalbild 2 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','c8ba16c899bd69b2d80ae073850b6284eb428405960631814040b6071820ab4f'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/03.jpg','Originalbild 3 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','b5293c543f670cea379f2b7a5b76df0b81c170ba124eb4e23642ea71780b1e41'),
('wellnesshotel-almhof-call','gallery','/reiseportal/unterkuenfte/wellnesshotel-almhof-call/02.jpg','Originalbild 4 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','3ae996e7216e01a4e057c486253657f7499414f7e7e2383f5892cd8ec89d7550'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/05.jpg','Originalbild 5 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','e677a2bac1c79609f9729e679e17ca556d6834ac763c88013f704a2c2aaf1cf4'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/06.jpg','Originalbild 6 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','e999a2e0c479b730bc9f1735c173bb2ce0a69380c63033a9ed6b3c06d05945dc'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/07.jpg','Originalbild 7 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','cf47b7afe4e511e701c769b663df581a407c2d526059bf29bba73af7693f6989'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/08.jpg','Originalbild 8 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','70b9402c2ad4e8f90af7b8d8d1cca9c31a166a5e49b822ba54de623aa0849ee7'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/09.jpg','Originalbild 9 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','8e17bba8d643a096f31ad63768b111e9e124a779c349f2335e7557c923b6ccbd'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/10.jpg','Originalbild 10 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','b3b5c9f6f5ef62905dfbacdc504111c888b6ace0a6e14036715dd64a10528b24'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/11.jpg','Originalbild 11 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','205876b0d3de927ff35b43343ec8f8694c6507c66f0457f11edb9a63b9810fc1'),
('wellnesshotel-almhof-call','gallery','/reiseportal/legacy-provider-media/wellnesshotel-almhof-call/12.jpg','Originalbild 12 von Wellnesshotel Almhof Call','Belegter Projekt-/Joomla-Medienbestand','8bfa3f0b88fc3398eecf557c07dd58c0645eaebfcfbf8f170f6c55e3eb60abb5'),
('wirodive-tauchreisen','gallery','/reiseportal/legacy-provider-media/wirodive-tauchreisen/01.jpg','Originalbild 1 von WIRODIVE Tauch- und Erlebnisreisen GmbH','Belegter Projekt-/Joomla-Medienbestand','34ef6c1f30be8c013a3cb1c09b90f504171c255d62dec7dcec0c05acdfb7fe97'),
('wirodive-tauchreisen','gallery','/reiseportal/legacy-provider-media/wirodive-tauchreisen/02.jpg','Originalbild 2 von WIRODIVE Tauch- und Erlebnisreisen GmbH','Belegter Projekt-/Joomla-Medienbestand','c8ad865fdd04cb6abcaa5aaf6d0c931c4c57c9bc28b873e897ca7ad123175530'),
('wirodive-tauchreisen','gallery','/reiseportal/legacy-provider-media/wirodive-tauchreisen/03.jpg','Originalbild 3 von WIRODIVE Tauch- und Erlebnisreisen GmbH','Belegter Projekt-/Joomla-Medienbestand','c265ec633db4b514d387e4510ad33c35226d58a31e47e567845d8fe3dcc6e488'),
('wirodive-tauchreisen','gallery','/reiseportal/legacy-provider-media/wirodive-tauchreisen/04.jpg','Originalbild 4 von WIRODIVE Tauch- und Erlebnisreisen GmbH','Belegter Projekt-/Joomla-Medienbestand','4c1b77a644417fbba228f56fe150e6bfdc944f83d23ba5f4e7e03afa4592944a'),
('wirodive-tauchreisen','gallery','/reiseportal/unterkuenfte/wirodive-tauchreisen/logo.png','Originalbild 5 von WIRODIVE Tauch- und Erlebnisreisen GmbH','Belegter Projekt-/Joomla-Medienbestand','e98e9a0480f5479da4cd9e9232b77a906399c8fd68aef1f31e95f25e2b40e401'),
('wirodive-tauchreisen','gallery','/reiseportal/legacy-provider-media/wirodive-tauchreisen/06.jpg','Originalbild 6 von WIRODIVE Tauch- und Erlebnisreisen GmbH','Belegter Projekt-/Joomla-Medienbestand','a7f277ada7a7c9353e88aec7c8a41b723fc2c8f5c90d6ad90a91833530566f60'),
('wirthshof','gallery','/reiseportal/unterkuenfte/wirthshof/01.jpg','Originalbild 1 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','9eda8c598f0b61e15ad6d716078d9149b3f43473053edf99da9c210efdc63e0d'),
('wirthshof','gallery','/reiseportal/unterkuenfte/wirthshof/02.jpg','Originalbild 2 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','5e78d63ae088e100c43c0569cfd8b2b822dd6942e71c32bcc419233806785cf5'),
('wirthshof','gallery','/reiseportal/legacy-provider-media/wirthshof/03.jpg','Originalbild 3 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','f5899831cc5af82765da61f0838b6abb7e93cf927bb7666f9d45f441a429059e'),
('wirthshof','gallery','/reiseportal/unterkuenfte/wirthshof/03.jpg','Originalbild 4 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','8d3f20215bf115d80a015ef76cfb61b585160b81037f75d74d46c55d6b5ca386'),
('wirthshof','gallery','/reiseportal/legacy-provider-media/wirthshof/05.jpg','Originalbild 5 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','30ed0742768f34759b68c52149a622bcc7a6c5afd2d38076fe0292ea27a219c9'),
('wirthshof','gallery','/reiseportal/unterkuenfte/wirthshof/logo.jpg','Originalbild 6 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','12e3f3da8e3bab3ac08ecaa1f3330304d9b980d922835a699c20027f5cba1f6d'),
('wirthshof','gallery','/reiseportal/legacy-provider-media/wirthshof/07.jpg','Originalbild 7 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','0c55975fb71515a275c38f47b3fdd8e5df95dc486a80baed5624b8108882104a'),
('wirthshof','gallery','/reiseportal/legacy-provider-media/wirthshof/08.jpg','Originalbild 8 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','d4b17af4cc9e56d3cc52cb6b00ef37e26eaa68de0f34cd94432974791ec0e72a'),
('wirthshof','gallery','/reiseportal/unterkuenfte/wirthshof/04.jpg','Originalbild 9 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','021ae18e3f01fe87677a6546368dea9680eefe50022255b47dbe5d15b8b04682'),
('wirthshof','gallery','/reiseportal/unterkuenfte/wirthshof/05.jpg','Originalbild 10 von Wirthshof','Belegter Projekt-/Joomla-Medienbestand','519e6583c9d9c80d2558b78e0f79ef61d84b309ccbe09d45c604aedd9c5fe422'),
('jaegeralpe','gallery','/reiseportal/legacy-provider-media/jaegeralpe/06.jpg','Wanderer im ursprünglichen Anbieterbild der Jägeralpe','Belegter P2-Reisekartenbestand','8bd0497994d924bf398fefc90c3ed687ce400cb7faee217144d61c11f6fe2736'),
('golfhotel-andreus','gallery','/reiseportal/legacy-directory/golfhotel-andreus.jpg','Historisches Verzeichnisbild von 5* Golfurlaub Südtirol- Das Golfhotel Andreus','/images/unterkuenfte/andreus/Vorschaubild.jpg','e2132a0422f1b79ee515e8af003a38d9d3716e90ae4d3bc6dc1003030932bf18'),
('anni-romantikhaeuschen','gallery','/reiseportal/legacy-directory/anni-romantikhaeuschen.jpg','Historisches Verzeichnisbild von Anni´s Romantikhäuschen in der Sächsische Schweiz','/images/unterkuenfte/annis-romantikhaeuschen/Annis-Romantikhaeuschen.jpg','a3c3eb51216099c256d267323f53f5a249af3759bc7900286cf19c2223efb050'),
('apartbauernhof-valrunzhof','gallery','/reiseportal/legacy-directory/apartbauernhof-valrunzhof.jpg','Historisches Verzeichnisbild von Apartbauernhof Valrunzhof','/images/unterkuenfte/valrunzhof/vorschaubild-400x400.jpg','8648d762d411d4ddb5eb2eac108ca41fa130b0907f9a35d0b2c1e069ec50043a'),
('appartementhaus-salzburg','gallery','/reiseportal/legacy-directory/appartementhaus-salzburg.jpg','Historisches Verzeichnisbild von Appartementhaus Salzburg','/images/unterkuenfte/haus-salzburg/kontaktbild-vorschaubild.jpg','9faea5b98f6789d74ab344f6dd26ebdf8e8f5b553cef77aeb0b0d42f7c2f0130'),
('bayerischer-wald','gallery','/reiseportal/legacy-directory/bayerischer-wald.jpg','Historisches Verzeichnisbild von Bayerischer Wald','/images/unterkuenfte/bayerischer-wald/logo.jpg','8d7f527595ca1369b6766474abe15d3ecb5e8203c9ade6fdfda0b1c6c1d2b30f'),
('blausee','gallery','/reiseportal/legacy-directory/blausee.jpg','Historisches Verzeichnisbild von Blausee','/images/unterkuenfte/Blausee/Vorschau.jpg','2cd63f4f46e0689b4c29bc6f781f1875b80cf51d105f69cb96333fd6573c208d'),
('camping-resort-allweglehen','gallery','/reiseportal/legacy-directory/camping-resort-allweglehen.jpg','Historisches Verzeichnisbild von Camping Resort Allweglehen','/images/unterkuenfte/Camping Resort Allweglehen/Vorschaubild.jpg','b4f81a5f9ba0ade891a7fa6381a40b3fa50017d21dff9634877c9c8e5010b555'),
('city-apart-dresden','gallery','/reiseportal/legacy-directory/city-apart-dresden.jpg','Historisches Verzeichnisbild von City Apart Dresden','/images/unterkuenfte/city-apart/Vorschaubild.jpg','5b4da774dc758c6603862f0b907a7a49b6442a9cc4025e9b27828eb1c355919d'),
('das-5-sterne-wellness-hotel-stock-resort','gallery','/reiseportal/legacy-directory/das-5-sterne-wellness-hotel-stock-resort.jpg','Historisches Verzeichnisbild von Das 5-Sterne-Wellness-Hotel STOCK resort','/images/unterkuenfte/stock/Vorschaubild.jpg','d6cd865cf860df0a73a8bbb66627ebce2beca13ee4db7da0a3e670f63e679acc'),
('der-koenigsleitner-romantik-zu-zweit','gallery','/reiseportal/legacy-directory/der-koenigsleitner-romantik-zu-zweit.jpg','Historisches Verzeichnisbild von Der Königsleitner - Romantik zu Zweit','/images/unterkuenfte/Der Konigsleitner/Vorschaubild 320x320.jpg','0bfd71c7d21258cd67cb02764aea7074239e0f597b821515cdcd10904311c6de'),
('feldhof-dolcevita-resort','gallery','/reiseportal/legacy-directory/feldhof-dolcevita-resort.jpg','Historisches Verzeichnisbild von FELDHOF DOLCEVITA RESORT','/images/unterkuenfte/Feldhof/Vorschaubild-Feldhof-350x350.jpg','8f55ea7a84f14f7eded351feb8692eb9b328f83900d72ec9f3d67725ba00d789'),
('ferienwohnung-sieber','gallery','/reiseportal/legacy-directory/ferienwohnung-sieber.jpg','Historisches Verzeichnisbild von Ferienwohnung Sieber','/images/unterkuenfte/ferienwohnung-siebert/details.jpg','0f997d1c597f841ea7c416f61c60519481435d45ffdd2b6b6c82e752efcdd6d8'),
('hoeflehner','gallery','/reiseportal/legacy-directory/hoeflehner.jpg','Historisches Verzeichnisbild von Höflehner','/images/unterkuenfte/Hoflehner/Vorschaubild-350x350-Hoflehner.jpg','86cf60f58eab7ca76477519ca9f6307a5c545a2e58aabedbff367a4456aee88e'),
('hotel-ravelli-luxury-spa','gallery','/reiseportal/legacy-directory/hotel-ravelli-luxury-spa.jpg','Historisches Verzeichnisbild von Hotel Ravelli Luxury Spa','/images/unterkuenfte/hotel-ravelli/vorschaubild-400x400.jpg','2a987db97f9ae94a67e012e6a59a514648c24e62e490239a05df807d12d7eead'),
('hotel-zur-post','gallery','/reiseportal/legacy-directory/hotel-zur-post.jpg','Historisches Verzeichnisbild von Hotel zur Post','/images/unterkuenfte/Hotel zur Post Altotting/Vorschaubild.jpg','2672539b8eb3ba6c49c3ac761ec88d4631138d1408a009fbb783fe44ef23de3c'),
('landgasthof-neue-schaenke','gallery','/reiseportal/legacy-directory/landgasthof-neue-schaenke.jpg','Historisches Verzeichnisbild von Landgasthof "Neue Schänke"','/images/unterkuenfte/neue-schaenke/Haus.jpg','583d4bba9f5bed6dd0e74b20f2c3e72e33fe4ff247ab5090838993ed4afe95d6'),
('ostsee-barfusspark','gallery','/reiseportal/legacy-directory/ostsee-barfusspark.jpg','Historisches Verzeichnisbild von OSTSEE - BARFUSSpark','/images/unterkuenfte/barfuss/intro.jpg','f2e5208c2b6fbc7fbb621583de9fb73b96a637f40cdd0e152bcff742c5484c00'),
('oversum-vital-resort-im-hochsauerland','gallery','/reiseportal/legacy-directory/oversum-vital-resort-im-hochsauerland.jpg','Historisches Verzeichnisbild von OVERSUM Vital Resort im Hochsauerland','/images/unterkuenfte/oversum/intro.jpg','b27663ae1f32bd3698be470659cb51c2a4f899140bec0c1f43df3477ef50d376'),
('pension-sonnenhof','gallery','/reiseportal/legacy-directory/pension-sonnenhof.jpg','Historisches Verzeichnisbild von Pension Sonnenhof','/images/unterkuenfte/Pension Sonnenhof/Vorschaubild.jpg','5395e90df5bddc724072c9aa26c1dd2d8815c87acc36d14198a085cf599f129d'),
('platzl-hotel','gallery','/reiseportal/legacy-directory/platzl-hotel.jpg','Historisches Verzeichnisbild von Platzl Hotel','/images/unterkuenfte/Platzl Hotel/Vorschaubild.jpg','21c4355bdda4439e1f300883179a8ba3d6b7436c61a8e48f4b3ff54fb71cf1e1'),
('rue-blanch','gallery','/reiseportal/legacy-directory/rue-blanch.jpg','Historisches Verzeichnisbild von Rü Blanch','/images/unterkuenfte/RU Blanch/Vorschaubild.jpg','f48b22b44ddfcf6fc7f580dcb7542f4e45b3b18c9834e2b736c24faaef2f9162'),
('schafhuber','gallery','/reiseportal/legacy-directory/schafhuber.jpg','Historisches Verzeichnisbild von Schafhuber','/images/unterkuenfte/Schafhuber/vorschau.jpg','6cd03b13d0cd402e3b0427390839ba1411081c76c3eb965f55b65aeba9b958d4'),
('schwarzwaelderhof','gallery','/reiseportal/legacy-directory/schwarzwaelderhof.jpg','Historisches Verzeichnisbild von Schwarzwälderhof','/images/unterkuenfte/Schwarzwalder Hof/vorschau.jpg','5d709b4c460e021434d195248054b899049d9a6bbd867e17da1a212755db1154'),
('sub-aqua-tauchreisen','gallery','/reiseportal/legacy-directory/sub-aqua-tauchreisen.jpg','Historisches Verzeichnisbild von SUB Aqua Tauchreisen','/images/unterkuenfte/SUB Aqua Tauchreisen/Vorschaubild.jpg','4fb3ab92954565b451252e6dd3aca54dbb6e3a3db586e63707bb5955b14d5fd8'),
('the-chedi','gallery','/reiseportal/legacy-directory/the-chedi.jpg','Historisches Verzeichnisbild von The Chedi','/images/unterkuenfte/The Chedi/Vorschaubild.jpg','4a19e8b0481ec913dfa99d52e58d0d18ed2ebec0f065785460d378a5c61b6d59'),
('urlaub-auf-borkum','gallery','/reiseportal/legacy-directory/urlaub-auf-borkum.jpg','Historisches Verzeichnisbild von Urlaub auf Borkum','/images/unterkuenfte/borkum/intro.jpg','e4a745da0c53539a25bace59706a5ad15c855948b8b69d175b640708b4a6bc19'),
('wirodive-tauchreisen','gallery','/reiseportal/legacy-directory/wirodive-tauchreisen.jpg','Historisches Verzeichnisbild von WIRODIVE Tauch- und Erlebnisreisen GmbH','/images/unterkuenfte/wiro-dive/VB.jpg','0b4da3fef5b66a5bfecc854a32bb163ac49f57f55a8fcfadd54df4bbd5fb8b33'),
('wirthshof','gallery','/reiseportal/legacy-directory/wirthshof.jpg','Historisches Verzeichnisbild von Wirthshof','/images/unterkuenfte/Wirtshof/Screenshot 2024-06-13 125044.jpg','85587fc270ac6b13f2f28d95ecca7b765c7b619bb359b5191e8af0f9c22067f9')
)
INSERT INTO public.media_library_assets(profile_id,bucket_id,storage_path,kind,name,alt_text,source,sha256)
SELECT p.id,'project-media',s.path,s.kind,left(regexp_replace(s.path,'^.*/',''),200),left(s.alt,500),left(s.source,1000),s.sha FROM sources s JOIN public.company_profiles p ON p.slug=s.slug
ON CONFLICT(bucket_id,storage_path) DO NOTHING;
INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,profile_id,context_key)
SELECT bucket_id,storage_path,id,profile_id,'original' FROM public.media_library_assets WHERE bucket_id='project-media';
