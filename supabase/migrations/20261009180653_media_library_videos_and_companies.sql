-- Additive catalog extension. No Storage triggers, bucket changes or existing row rewrites.
ALTER TABLE public.media_library_assets DROP CONSTRAINT media_library_assets_bucket_id_check;
ALTER TABLE public.media_library_assets ADD CONSTRAINT media_library_assets_bucket_id_check CHECK(bucket_id IN ('company-media','ad-media','project-media','company-profile-videos','external-video'));
ALTER TABLE public.media_library_assets DROP CONSTRAINT media_library_assets_kind_check;
ALTER TABLE public.media_library_assets ADD CONSTRAINT media_library_assets_kind_check CHECK(kind IN ('gallery','logo','contact','block','banner','video'));
ALTER TABLE public.media_library_assets ADD COLUMN mime_type text, ADD COLUMN byte_size bigint CHECK(byte_size IS NULL OR byte_size BETWEEN 1 AND 52428800);
ALTER TABLE public.media_library_files DROP CONSTRAINT media_library_files_bucket_id_check;
ALTER TABLE public.media_library_files ADD CONSTRAINT media_library_files_bucket_id_check CHECK(bucket_id IN ('company-media','ad-media','project-media','company-profile-videos','external-video'));
-- External originals are canonical provider URLs, never arbitrary iframe markup.
ALTER TABLE public.media_library_assets ADD CONSTRAINT media_library_video_identity CHECK (
 bucket_id NOT IN ('company-profile-videos','external-video') OR (kind='video' AND profile_id IS NOT NULL AND
 (bucket_id='company-profile-videos' AND storage_path ~ ('^profiles/'||profile_id::text||'/video/[0-9a-f-]{36}\.(mp4|webm)$')
 OR bucket_id='external-video' AND storage_path ~ '^https://(www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}|vimeo\.com/[0-9]{1,20})$')));
CREATE TABLE public.profile_video_uses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
 block_id uuid UNIQUE REFERENCES public.profile_content_blocks(id) ON DELETE CASCADE,
 asset_id uuid NOT NULL REFERENCES public.media_library_assets(id),
 storage_path text, external_url text,
 CHECK ((storage_path IS NULL) <> (external_url IS NULL))
);
CREATE UNIQUE INDEX profile_video_header_use ON public.profile_video_uses(profile_id) WHERE block_id IS NULL;
ALTER TABLE public.profile_video_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_video_uses FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profile_video_uses TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.profile_video_uses TO authenticated;
CREATE POLICY profile_video_uses_read ON public.profile_video_uses FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.company_profiles p WHERE p.id=profile_id));
CREATE POLICY profile_video_uses_admin ON public.profile_video_uses FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())))
 WITH CHECK(EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
CREATE FUNCTION private.guard_profile_video_use() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.media_library_assets;
BEGIN
 SELECT * INTO a FROM public.media_library_assets WHERE id=NEW.asset_id FOR SHARE;
 IF NOT FOUND OR a.kind<>'video' OR a.profile_id<>NEW.profile_id OR a.archived_at IS NOT NULL OR a.deletion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'video unavailable'; END IF;
 IF NEW.block_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profile_content_blocks WHERE id=NEW.block_id AND profile_id=NEW.profile_id AND type='video' AND slot IS NULL) THEN RAISE EXCEPTION 'invalid video block'; END IF;
 IF a.bucket_id='company-profile-videos' THEN
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=a.bucket_id AND name=a.storage_path AND (metadata->>'size')::bigint BETWEEN 1 AND 52428800 AND metadata->>'mimetype'=CASE WHEN storage.objects.name LIKE '%.mp4' THEN 'video/mp4' ELSE 'video/webm' END) THEN RAISE EXCEPTION 'video object unavailable'; END IF;
  NEW.storage_path:=a.storage_path; NEW.external_url:=NULL;
 ELSIF a.bucket_id='external-video' THEN NEW.external_url:=a.storage_path; NEW.storage_path:=NULL;
 ELSE RAISE EXCEPTION 'invalid video kind'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_profile_video_use() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_profile_video_use BEFORE INSERT OR UPDATE ON public.profile_video_uses FOR EACH ROW EXECUTE FUNCTION private.guard_profile_video_use();
-- Public access only for a specifically referenced, approved profile video block.
CREATE POLICY profile_video_block_read ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='company-profile-videos' AND EXISTS(SELECT 1 FROM public.profile_video_uses u JOIN public.company_profiles p ON p.id=u.profile_id WHERE u.storage_path=name AND p.status='approved'));
CREATE POLICY media_library_video_retention ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (
 bucket_id<>'company-profile-videos' OR private.media_library_delete_allowed(bucket_id,name));
CREATE FUNCTION private.catalog_profile_video_use() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid;
BEGIN
 IF NEW.video_path IS DISTINCT FROM OLD.video_path THEN
  DELETE FROM public.profile_video_uses WHERE profile_id=NEW.id AND block_id IS NULL;
 END IF;
 IF NEW.video_path IS NOT NULL THEN
  INSERT INTO public.media_library_assets(profile_id,bucket_id,storage_path,kind,name,mime_type,byte_size)
   SELECT NEW.id,'company-profile-videos',NEW.video_path,'video',left(regexp_replace(NEW.video_path,'^.*/',''),200),metadata->>'mimetype',(metadata->>'size')::bigint FROM storage.objects WHERE bucket_id='company-profile-videos' AND name=NEW.video_path
   ON CONFLICT(bucket_id,storage_path) DO NOTHING;
  SELECT id INTO a FROM public.media_library_assets WHERE bucket_id='company-profile-videos' AND storage_path=NEW.video_path;
  IF a IS NOT NULL THEN INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,profile_id,context_key) VALUES('company-profile-videos',NEW.video_path,a,NEW.id,'original') ON CONFLICT DO NOTHING; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.catalog_profile_video_use() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER catalog_profile_video_use AFTER UPDATE OF video_path ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION private.catalog_profile_video_use();
-- Invoker entry point; company_profiles RLS and existing column-level privileges still govern the header.
CREATE FUNCTION public.media_library_use_video(p_profile uuid,p_asset uuid,p_block uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.media_library_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.media_library_assets WHERE id=p_asset AND profile_id=p_profile AND kind='video' AND archived_at IS NULL AND deletion_requested_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'video unavailable'; END IF;
 IF p_block IS NULL THEN
  UPDATE public.company_profiles SET video_path=CASE WHEN a.bucket_id='company-profile-videos' THEN a.storage_path ELSE NULL END WHERE id=p_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  DELETE FROM public.profile_video_uses WHERE profile_id=p_profile AND block_id IS NULL;
 END IF;
 INSERT INTO public.profile_video_uses(profile_id,block_id,asset_id,storage_path,external_url)
 VALUES(p_profile,p_block,p_asset,CASE WHEN a.bucket_id='company-profile-videos' THEN a.storage_path END,CASE WHEN a.bucket_id='external-video' THEN a.storage_path END)
 ON CONFLICT(block_id) DO UPDATE SET asset_id=EXCLUDED.asset_id;
END; $$;
REVOKE ALL ON FUNCTION public.media_library_use_video(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_use_video(uuid,uuid,uuid) TO authenticated;
-- Atomic ownerless draft creation, private checked definer behind an invoker entry point.
CREATE FUNCTION private.admin_create_media_company(p_name text,p_city text,p_country text,p_website text,p_override boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE company uuid:=gen_random_uuid(); profile uuid:=gen_random_uuid(); matches jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 p_name:=btrim(p_name); p_city:=btrim(p_city);p_country:=btrim(p_country);p_website:=btrim(p_website);
 IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 1 AND 200 OR char_length(p_city)>200 OR char_length(p_country)>120 OR char_length(p_website)>1000 OR (p_website<>'' AND p_website !~ '^https?://[^[:space:]]+$') THEN RAISE EXCEPTION 'invalid company'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_name),0));
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO matches FROM (SELECT id,display_name FROM public.company_profiles WHERE lower(display_name) LIKE '%'||lower(p_name)||'%' OR lower(p_name) LIKE '%'||lower(display_name)||'%' ORDER BY display_name LIMIT 10)c;
 IF jsonb_array_length(matches)>0 AND p_override IS NOT TRUE THEN RETURN jsonb_build_object('matches',matches); END IF;
 INSERT INTO public.companies(id,legal_name,owner_user_id) VALUES(company,p_name,NULL);
 INSERT INTO public.company_profiles(id,company_id,slug,display_name,status,approval_context,city,country,region,website)
 VALUES(profile,company,'unternehmen-'||profile::text,p_name,'draft','reiseportal',nullif(p_city,''),coalesce(p_country,''),'',nullif(p_website,''));
 RETURN jsonb_build_object('id',profile,'display_name',p_name);
END; $$;
REVOKE ALL ON FUNCTION private.admin_create_media_company(text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_create_media_company(text,text,text,text,boolean) TO authenticated;
CREATE FUNCTION public.media_library_create_company(p_name text,p_city text DEFAULT '',p_country text DEFAULT '',p_website text DEFAULT '',p_override boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' BEGIN ATOMIC SELECT private.admin_create_media_company(p_name,p_city,p_country,p_website,p_override); END;
REVOKE ALL ON FUNCTION public.media_library_create_company(text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_create_company(text,text,text,text,boolean) TO authenticated;

ALTER TABLE public.profile_content_blocks DROP CONSTRAINT profile_content_blocks_type_check;
ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_blocks_type_check CHECK ((type = ANY (ARRAY['heading'::text, 'text'::text, 'video'::text, 'image_grid'::text])));

ALTER TABLE public.profile_content_blocks DROP CONSTRAINT profile_content_text_shape;
ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_text_shape CHECK (((jsonb_typeof(content) = 'object'::text) AND (((type = 'image_grid'::text) AND (content = '{}'::jsonb)) OR ((type = ANY (ARRAY['heading'::text, 'text'::text, 'video'::text])) AND (content ? 'text'::text) AND (jsonb_typeof((content -> 'text'::text)) = 'string'::text) AND (((type = 'video'::text) OR (char_length(btrim((content ->> 'text'::text))) >= 1)) AND (char_length(btrim((content ->> 'text'::text))) <=
CASE
    WHEN (type = 'heading'::text) THEN 200
    ELSE 10000
END))))));

ALTER TABLE public.profile_content_blocks DROP CONSTRAINT profile_content_image_config;
ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_image_config CHECK ((((slot IS NOT NULL) AND (type = 'heading'::text) AND (config = '{}'::jsonb)) OR ((slot IS NULL) AND (jsonb_typeof((config -> 'width_percent'::text)) = 'number'::text) AND ((((config ->> 'width_percent'::text))::numeric >= (25)::numeric) AND (((config ->> 'width_percent'::text))::numeric <= (100)::numeric)) AND (((config ->> 'width_percent'::text))::numeric = trunc(((config ->> 'width_percent'::text))::numeric)) AND (jsonb_typeof((config -> 'offset_percent'::text)) = 'number'::text) AND (((config ->> 'offset_percent'::text))::numeric >= (0)::numeric) AND ((((config ->> 'offset_percent'::text))::numeric * (10)::numeric) = trunc((((config ->> 'offset_percent'::text))::numeric * (10)::numeric))) AND ((((config ->> 'width_percent'::text))::numeric + ((config ->> 'offset_percent'::text))::numeric) <= (100)::numeric) AND ((config ->> 'spacing_top'::text) = ANY (ARRAY['small'::text, 'normal'::text, 'large'::text])) AND ((config ->> 'spacing_bottom'::text) = ANY (ARRAY['small'::text, 'normal'::text, 'large'::text])) AND (((type = ANY (ARRAY['heading'::text, 'text'::text, 'video'::text])) AND ((config ->> 'text_align'::text) = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])) AND (config = jsonb_build_object('width_percent', ((config ->> 'width_percent'::text))::integer, 'offset_percent', ((config ->> 'offset_percent'::text))::numeric, 'text_align', (config ->> 'text_align'::text), 'spacing_top', (config ->> 'spacing_top'::text), 'spacing_bottom', (config ->> 'spacing_bottom'::text)))) OR ((type = 'image_grid'::text) AND (jsonb_typeof((config -> 'columns'::text)) = 'number'::text) AND ((config ->> 'columns'::text) = ANY (ARRAY['1'::text, '2'::text, '3'::text, '4'::text])) AND (jsonb_typeof((config -> 'aspect_ratio'::text)) = 'number'::text) AND ((((config ->> 'aspect_ratio'::text))::numeric >= 0.6) AND (((config ->> 'aspect_ratio'::text))::numeric <= (3)::numeric)) AND ((((config ->> 'aspect_ratio'::text))::numeric * (100)::numeric) = trunc((((config ->> 'aspect_ratio'::text))::numeric * (100)::numeric))) AND (config = jsonb_build_object('columns', ((config ->> 'columns'::text))::integer, 'width_percent', ((config ->> 'width_percent'::text))::integer, 'offset_percent', ((config ->> 'offset_percent'::text))::numeric, 'aspect_ratio', ((config ->> 'aspect_ratio'::text))::numeric, 'spacing_top', (config ->> 'spacing_top'::text), 'spacing_bottom', (config ->> 'spacing_bottom'::text))))))));
CREATE OR REPLACE FUNCTION public.media_library_page(p_profile uuid DEFAULT NULL::uuid, p_kind text DEFAULT ''::text, p_query text DEFAULT ''::text, p_page integer DEFAULT 1, p_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$

DECLARE items jsonb; total integer;

BEGIN

 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;

 IF p_page<1 OR p_page>100000 OR char_length(p_query)>200 OR p_kind NOT IN ('','gallery','logo','contact','block','banner','video','images','unused') THEN RAISE EXCEPTION 'invalid catalog query'; END IF;

 WITH matches AS (SELECT a.*,p.display_name profile_name FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id

 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile) OR EXISTS(SELECT 1 FROM public.company_ad_campaigns campaign JOIN public.media_library_files banner_file ON banner_file.bucket_id='ad-media' AND banner_file.storage_path=campaign.image_path WHERE banner_file.asset_id=a.id AND campaign.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived)

 AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id IN ('project-media','external-video') OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id)) AND (p_kind IN ('','unused') OR a.kind=p_kind OR p_kind='images' AND a.kind<>'video')

 AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')

 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0)))

 SELECT count(*) INTO total FROM matches;

 SELECT coalesce(jsonb_agg(item),'[]'::jsonb) INTO items FROM (

 SELECT to_jsonb(a)||jsonb_build_object('profile_name',p.display_name,'preview_file',(SELECT jsonb_build_object('bucket',f.bucket_id,'path',f.storage_path) FROM public.media_library_files f WHERE f.asset_id=a.id AND (f.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=f.bucket_id AND o.name=f.storage_path)) ORDER BY (f.context_key='original') DESC,f.storage_path LIMIT 1),'usages',coalesce((SELECT jsonb_agg(u) FROM public.media_library_files f CROSS JOIN LATERAL jsonb_array_elements(public.media_library_asset_references(f.bucket_id,f.storage_path)) u WHERE f.asset_id=a.id),'[]'::jsonb)) item

 FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id

 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile) OR EXISTS(SELECT 1 FROM public.company_ad_campaigns campaign JOIN public.media_library_files banner_file ON banner_file.bucket_id='ad-media' AND banner_file.storage_path=campaign.image_path WHERE banner_file.asset_id=a.id AND campaign.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived) AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id IN ('project-media','external-video') OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id))

 AND (p_kind IN ('','unused') OR a.kind=p_kind OR p_kind='images' AND a.kind<>'video') AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')

 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0))

 ORDER BY a.created_at DESC,a.id LIMIT 24 OFFSET (p_page-1)*24) page;

 RETURN jsonb_build_object('items',items,'count',total);

END; $function$
;
CREATE OR REPLACE FUNCTION private.guard_media_library_file()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.media_library_assets;
BEGIN
 SELECT * INTO a FROM public.media_library_assets WHERE id=NEW.asset_id FOR SHARE;
 IF NOT FOUND OR a.deletion_requested_at IS NOT NULL OR (NEW.bucket_id NOT IN ('project-media','external-video') AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=NEW.bucket_id AND name=NEW.storage_path)) THEN RAISE EXCEPTION 'original unavailable'; END IF;
 IF NEW.context_key='original' THEN
  IF NEW.bucket_id<>a.bucket_id OR NEW.storage_path<>a.storage_path OR NEW.profile_id IS DISTINCT FROM a.profile_id THEN RAISE EXCEPTION 'invalid original identity'; END IF;
 ELSE
  IF NEW.bucket_id<>'company-media' OR NEW.profile_id IS NULL OR NEW.storage_path NOT LIKE 'profiles/'||NEW.profile_id::text||'/%' OR NEW.context_key NOT LIKE NEW.profile_id::text||':%' THEN RAISE EXCEPTION 'invalid copy identity'; END IF;
 END IF;
 RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION private.media_library_references(p_bucket text, p_path text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce(jsonb_agg(jsonb_build_object('label',label,'profileId',profile_id,'id',id)),'[]'::jsonb) FROM (
 SELECT 'Unternehmensgalerie'::text label,i.profile_id,i.id FROM public.company_profile_images i WHERE p_bucket='company-media' AND i.storage_path=p_path
 UNION ALL SELECT 'Logo',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-media' AND p.logo_path=p_path
 UNION ALL SELECT 'Ansprechpartnerbild',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-media' AND p.contact_image_path=p_path
 UNION ALL SELECT 'Inhaltsblock',b.profile_id,i.id FROM public.profile_content_block_images i JOIN public.profile_content_blocks b ON b.id=i.block_id WHERE p_bucket='company-media' AND i.storage_path=p_path
 UNION ALL SELECT 'Werbebanner',c.profile_id,c.id FROM public.company_ad_campaigns c WHERE p_bucket='ad-media' AND c.image_path=p_path
 UNION ALL SELECT 'Profilvideo',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-profile-videos' AND p.video_path=p_path
 UNION ALL SELECT CASE WHEN u.block_id IS NULL THEN 'Profilvideo (Mediathek)' ELSE 'Video-Inhaltsblock' END,u.profile_id,u.id FROM public.profile_video_uses u WHERE (p_bucket='company-profile-videos' AND u.storage_path=p_path) OR (p_bucket='external-video' AND u.external_url=p_path)
 ) refs;
$function$
;
CREATE FUNCTION public.media_library_register_video(p_profile uuid,p_path text,p_name text,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE asset uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_path !~ ('^profiles/'||p_profile::text||'/video/[0-9a-f-]{36}\.(mp4|webm)$') OR p_hash !~ '^[0-9a-f]{64}$' OR char_length(p_name) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid video'; END IF;
 INSERT INTO public.media_library_assets(profile_id,bucket_id,storage_path,kind,name,sha256,mime_type,byte_size)
 SELECT p_profile,'company-profile-videos',p_path,'video',p_name,p_hash,metadata->>'mimetype',(metadata->>'size')::bigint FROM storage.objects WHERE bucket_id='company-profile-videos' AND name=p_path AND (metadata->>'size')::bigint BETWEEN 1 AND 52428800 AND metadata->>'mimetype'=CASE WHEN storage.objects.name LIKE '%.mp4' THEN 'video/mp4' ELSE 'video/webm' END RETURNING id INTO asset;
 IF asset IS NULL THEN RAISE EXCEPTION 'video unavailable'; END IF;
 INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,profile_id,context_key) VALUES('company-profile-videos',p_path,asset,p_profile,'original');
 RETURN asset;
END; $$;
REVOKE ALL ON FUNCTION public.media_library_register_video(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_register_video(uuid,text,text,text) TO authenticated;

-- Image subtype is changed only through the explicitly checked private admin operation.
CREATE FUNCTION private.admin_register_media_image(p_profile uuid,p_path text,p_name text,p_hash text,p_kind text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('gallery','logo','contact','block','banner') THEN RAISE EXCEPTION 'invalid image kind'; END IF;
 asset:=public.media_library_register_upload(p_profile,p_path,p_name,p_hash);
 UPDATE public.media_library_assets SET kind=p_kind WHERE id=asset AND profile_id=p_profile AND bucket_id='company-media';
 RETURN asset;
END; $$;
REVOKE ALL ON FUNCTION private.admin_register_media_image(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_register_media_image(uuid,text,text,text,text) TO authenticated;
CREATE FUNCTION public.media_library_register_image(p_profile uuid,p_path text,p_name text,p_hash text,p_kind text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' BEGIN ATOMIC SELECT private.admin_register_media_image(p_profile,p_path,p_name,p_hash,p_kind); END;
REVOKE ALL ON FUNCTION public.media_library_register_image(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.media_library_register_image(uuid,text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION private.track_profile_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE

  previous jsonb := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;

  current_row jsonb := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;

  keys text[]; before_content jsonb; after_content jsonb;

  target uuid; former_target uuid; actor uuid := auth.uid(); source text;

  heading text; empty_slot jsonb;

BEGIN

  CASE TG_TABLE_NAME

    WHEN 'company_profiles' THEN

      keys := ARRAY['display_name','tagline','description','business_areas','phone','public_email','website',

        'street','postal_code','city','region','country','logo_path','logo_url','video_path','contact_first_name','contact_last_name','contact_image_path'];

      target := COALESCE(current_row->>'id',previous->>'id')::uuid;

      IF TG_OP='DELETE' THEN RETURN OLD; END IF;

    WHEN 'company_profile_categories' THEN keys:=ARRAY['category_id'];

    WHEN 'company_profile_travel_terms' THEN keys:=ARRAY['term_key'];

    WHEN 'company_profile_images' THEN keys:=ARRAY['storage_path','alt_text'];

    WHEN 'profile_content_blocks' THEN keys:=ARRAY['type','slot'];

    WHEN 'profile_video_uses' THEN keys:=ARRAY['asset_id','block_id','storage_path','external_url'];
    WHEN 'profile_content_block_images' THEN keys:=ARRAY['storage_path','alt_text','caption'];

    ELSE RAISE EXCEPTION 'unsupported review subject';

  END CASE;

  IF TG_TABLE_NAME='profile_content_block_images' THEN

    SELECT profile_id INTO target FROM public.profile_content_blocks

      WHERE id=COALESCE(current_row->>'block_id',previous->>'block_id')::uuid;

    SELECT profile_id INTO former_target FROM public.profile_content_blocks

      WHERE id=(previous->>'block_id')::uuid;

    -- Cascade deletion of the parent block already counts as content removal.

  ELSIF TG_TABLE_NAME<>'company_profiles' THEN

    target:=COALESCE(current_row->>'profile_id',previous->>'profile_id')::uuid;

    former_target:=(previous->>'profile_id')::uuid;

  END IF;

  SELECT jsonb_object_agg(k, previous->k),jsonb_object_agg(k,current_row->k)

    INTO before_content,after_content FROM unnest(keys) k;

  IF TG_TABLE_NAME='profile_content_blocks' THEN

    -- Pairing existing images, alignment and layout are presentation, not new content.

    before_content:=before_content || jsonb_build_object('content',

      jsonb_strip_nulls(jsonb_build_object('text',previous->'content'->'text','title',previous->'content'->'title',

        'hidden',NULLIF(previous->'content'->'hidden','false'::jsonb),

        'heading_hidden',NULLIF(previous->'content'->'heading_hidden','false'::jsonb),

        'hidden_blocks',NULLIF(previous->'content'->'hidden_blocks','[]'::jsonb),

        'deleted_sections',NULLIF(previous->'content'->'deleted_sections','[]'::jsonb))));

    after_content:=after_content || jsonb_build_object('content',

      jsonb_strip_nulls(jsonb_build_object('text',current_row->'content'->'text','title',current_row->'content'->'title',

        'hidden',NULLIF(current_row->'content'->'hidden','false'::jsonb),

        'heading_hidden',NULLIF(current_row->'content'->'heading_hidden','false'::jsonb),

        'hidden_blocks',NULLIF(current_row->'content'->'hidden_blocks','[]'::jsonb),

        'deleted_sections',NULLIF(current_row->'content'->'deleted_sections','[]'::jsonb))));

    -- ensureSection persists an already visible default heading on first layout edit.

    -- Creating/removing that backing row alone does not change public content.

    IF COALESCE(current_row->>'slot',previous->>'slot') IS NOT NULL THEN

      SELECT CASE WHEN COALESCE(current_row->>'slot',previous->>'slot')='about_heading'

        THEN left('Über ' || display_name,200) ELSE 'Tätigkeitsbereiche' END INTO heading

        FROM public.company_profiles WHERE id=target;

      empty_slot:=jsonb_build_object('type','heading','slot',COALESCE(current_row->>'slot',previous->>'slot'),

        'content',jsonb_build_object('text',heading));

      IF TG_OP='INSERT' THEN before_content:=empty_slot; END IF;

      IF TG_OP='DELETE' THEN after_content:=empty_slot; END IF;

    END IF;

  END IF;

  IF before_content IS NOT DISTINCT FROM after_content

    AND (former_target IS NULL OR former_target=target) THEN

    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;

  END IF;

  source:=CASE WHEN actor IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=actor) THEN 'admin'

    WHEN actor IS NOT NULL THEN 'provider'

    WHEN current_setting('app.content_update_source',true)='import' THEN 'import' ELSE 'system' END;

  -- Upsert serializes revision increments with the deliberate review RPC.

  INSERT INTO public.profile_content_freshness(profile_id,content_updated_at,content_updated_by,content_update_source)

    SELECT target,clock_timestamp(),actor,source WHERE EXISTS(SELECT 1 FROM public.company_profiles WHERE id=target)

    ON CONFLICT(profile_id) DO UPDATE SET content_revision=profile_content_freshness.content_revision+1,

      content_updated_at=EXCLUDED.content_updated_at,content_updated_by=EXCLUDED.content_updated_by,

      content_update_source=EXCLUDED.content_update_source;

  IF former_target IS NOT NULL AND former_target<>target THEN

    UPDATE public.profile_content_freshness SET content_revision=content_revision+1,

      content_updated_at=clock_timestamp(),content_updated_by=actor,content_update_source=source

      WHERE profile_id=former_target;

  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;

END;

$function$
;
CREATE TRIGGER profile_freshness_video_uses AFTER INSERT OR UPDATE OR DELETE ON public.profile_video_uses FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();

CREATE OR REPLACE FUNCTION public.duplicate_profile_content_block(
  p_profile_id uuid, p_block_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE original public.profile_content_blocks%ROWTYPE; new_id uuid; source_image record; new_image_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p WHERE p.id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  SELECT * INTO original FROM public.profile_content_blocks
    WHERE id = p_block_id AND profile_id = p_profile_id AND slot IS NULL
      AND type IN ('heading','text','image_grid','video');
  IF NOT FOUND THEN RAISE EXCEPTION 'block does not belong to profile'; END IF;
  UPDATE public.profile_content_blocks SET sort_order = sort_order + 1
    WHERE profile_id = p_profile_id AND slot IS NULL AND sort_order > original.sort_order;
  INSERT INTO public.profile_content_blocks(profile_id,type,sort_order,content,config)
    VALUES (p_profile_id,original.type,original.sort_order + 1,original.content,original.config)
    RETURNING id INTO new_id;
  IF original.type = 'image_grid' THEN
    FOR source_image IN SELECT * FROM public.profile_content_block_images
      WHERE block_id = original.id ORDER BY sort_order, id LOOP
      INSERT INTO public.profile_content_block_images(block_id,storage_path,alt_text,sort_order)
        VALUES (new_id,source_image.storage_path,source_image.alt_text,source_image.sort_order)
        RETURNING id INTO new_image_id;
      UPDATE public.profile_content_block_images SET
        focus_x = source_image.focus_x, focus_y = source_image.focus_y,
        zoom = source_image.zoom, caption = source_image.caption
        WHERE id = new_image_id AND block_id = new_id;
    END LOOP;
  END IF;
  IF original.type='video' THEN
    INSERT INTO public.profile_video_uses(profile_id,block_id,asset_id,storage_path,external_url)
      SELECT p_profile_id,new_id,asset_id,storage_path,external_url FROM public.profile_video_uses WHERE block_id=original.id AND profile_id=p_profile_id;
  END IF;
  RETURN new_id;
END;
$$;

-- Only exact imported Joomla article identities; external links, no public usage or file download.
DO $seed$ DECLARE r record; asset uuid; BEGIN
 FOR r IN SELECT * FROM (VALUES ('72312763-41f2-4adb-aaf2-de47b705a714'::uuid,'https://www.youtube.com/watch?v=4uUWS8PGsgE','Blausee – Video','Joomla Artikel 473; rich_content.video_link/video_code'),('49b2316e-dd69-4d68-9f10-b7fc86100cf8'::uuid,'https://www.youtube.com/watch?v=EWKiPV1So5A','Pension Sonnenhof – Video','Joomla Artikel 470; rich_content.video_link/video_code'),('2d2bcce8-f87c-43e6-b460-433f2c414ac1'::uuid,'https://www.youtube.com/watch?v=YTQKWsA_SFE','Schwarzwälderhof – Video','Joomla Artikel 469; rich_content.video_link/video_code'),('b9594b15-178c-4ba1-b28d-ea129907ec63'::uuid,'https://www.youtube.com/watch?v=dvGW_ux-90M','Wirthshof – Video','Joomla Artikel 468; rich_content.video_link/video_code'),('8d709f0a-46fd-41e8-b9cf-1d9a37768a46'::uuid,'https://www.youtube.com/watch?v=uIwUDVzRCdc','Camping Resort Allweglehen – Video','Joomla Artikel 467; rich_content.video_link/video_code'),('92256160-1734-4079-8ddf-07cacdc5da50'::uuid,'https://www.youtube.com/watch?v=T4GMbUo-zwI','The Chedi – Video','Joomla Artikel 466; rich_content.video_link/video_code'),('97942ec4-5ee9-48ba-8357-35d91f261186'::uuid,'https://www.youtube.com/watch?v=FYY1q3c-FvI','Schafhuber – Video','Joomla Artikel 465; rich_content.video_link/video_code'),('080f5336-ecbf-402c-a28f-1fbc16a30313'::uuid,'https://www.youtube.com/watch?v=n1bSXP10c-Q','Höflehner – Video','Joomla Artikel 464; rich_content.video_link/video_code'),('05485363-8860-4143-aff4-ec4806da83df'::uuid,'https://www.youtube.com/watch?v=HNoPZo4PpJY','Jägeralpe – Video','Joomla Artikel 463; rich_content.video_link/video_code'),('ac51f96a-1770-44b7-b397-0347e21fb890'::uuid,'https://www.youtube.com/watch?v=aPIQsF2yJ0w','5* Golfurlaub Südtirol- Das Golfhotel Andreus – Video','Joomla Artikel 452; rich_content.video_link/video_code'),('14db48c3-57b8-4146-9e3b-f0c567b422f3'::uuid,'https://www.youtube.com/watch?v=3B-g1f2AMCE','Das 5-Sterne-Wellness-Hotel STOCK resort – Video','Joomla Artikel 451; rich_content.video_link/video_code'),('7e1819ad-6097-4dd6-b251-ea023f0177cb'::uuid,'https://www.youtube.com/watch?v=Oa_gFHwDWRg','Urlaub auf Borkum – Video','Joomla Artikel 448; rich_content.video_link/video_code'),('810408f9-8eb5-4d17-816f-8b79f301b500'::uuid,'https://www.youtube.com/watch?v=pt5599fn4Kk','City Apart Dresden – Video','Joomla Artikel 447; rich_content.video_link/video_code'),('3fc69450-9485-4e93-82d9-aae5b69fedb4'::uuid,'https://vimeo.com/196000808','Ferienwohnung Sieber – Video','Joomla Artikel 446; rich_content.video_link/video_code'),('be2d43a1-472c-47c2-a57f-e7e6ae91809e'::uuid,'https://www.youtube.com/watch?v=nDlPGMeHae8','Landgasthof "Neue Schänke" – Video','Joomla Artikel 442; rich_content.video_link/video_code')) AS originals(profile_id,url,name,source) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE id=r.profile_id) THEN RAISE EXCEPTION 'Joomla profile missing; stop import'; END IF;
  INSERT INTO public.media_library_assets(profile_id,bucket_id,storage_path,kind,name,mime_type,source)
    VALUES(r.profile_id,'external-video',r.url,'video',left(r.name,200),'external/video',r.source) ON CONFLICT(bucket_id,storage_path) DO NOTHING;
  SELECT id INTO asset FROM public.media_library_assets WHERE profile_id=r.profile_id AND bucket_id='external-video' AND storage_path=r.url;
  IF asset IS NULL THEN RAISE EXCEPTION 'external source identity conflict'; END IF;
  INSERT INTO public.media_library_files(bucket_id,storage_path,asset_id,profile_id,context_key) VALUES('external-video',r.url,asset,r.profile_id,'original') ON CONFLICT DO NOTHING;
 END LOOP;
END; $seed$;
