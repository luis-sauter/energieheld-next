-- Publication uses existing approval and presentation visibility, never resets approval.
-- No profile/media/term/campaign data are changed by applying this migration.
CREATE FUNCTION private.set_travel_profile_publication(p_profile_id uuid,p_publish boolean,p_expected_revision bigint,p_expected_proposals text[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile public.company_profiles%ROWTYPE; revision bigint; listed boolean;
BEGIN
 IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF p_publish IS NULL THEN RAISE EXCEPTION 'publication decision required'; END IF;
 SELECT * INTO profile FROM public.company_profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 SELECT COALESCE((SELECT is_listed FROM public.company_profile_public_visibility WHERE profile_id=p_profile_id),true) INTO listed;
 -- Repeated publish/withdraw requests are harmless and do not reapprove a profile.
 IF profile.status='approved' AND listed=p_publish THEN RETURN CASE WHEN listed THEN 'published' ELSE 'withdrawn' END; END IF;
 SELECT content_revision INTO revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id FOR UPDATE;
 IF revision IS NULL OR p_expected_revision IS DISTINCT FROM revision THEN RAISE EXCEPTION 'profile changed; reload review' USING ERRCODE='40001'; END IF;
 IF p_publish AND profile.status<>'approved' THEN
   -- Only admin-created ownerless Reiseportal drafts may enter the existing review flow.
   -- Owner drafts still require the owner's explicit submission.
   IF profile.status='draft' AND profile.approval_context='reiseportal' AND EXISTS(SELECT 1 FROM public.companies WHERE id=profile.company_id AND owner_user_id IS NULL) THEN
     UPDATE public.company_profiles SET status='pending' WHERE id=p_profile_id;
   ELSIF profile.status<>'pending' THEN RAISE EXCEPTION 'profile not ready for review'; END IF;
   PERFORM private.review_travel_profile_with_proposals(p_profile_id,'approved',NULL,p_expected_revision,p_expected_proposals);
 ELSIF profile.status<>'approved' THEN RAISE EXCEPTION 'profile not published'; END IF;
 INSERT INTO public.company_profile_public_visibility(profile_id,is_listed) VALUES(p_profile_id,p_publish)
 ON CONFLICT(profile_id) DO UPDATE SET is_listed=EXCLUDED.is_listed;
 RETURN CASE WHEN p_publish THEN 'published' ELSE 'withdrawn' END;
END;
$$;
REVOKE ALL ON FUNCTION private.set_travel_profile_publication(uuid,boolean,bigint,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_travel_profile_publication(uuid,boolean,bigint,text[]) TO authenticated;
CREATE FUNCTION public.set_travel_profile_publication(p_profile_id uuid,p_publish boolean,p_expected_revision bigint,p_expected_proposals text[])
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.set_travel_profile_publication(p_profile_id,p_publish,p_expected_revision,p_expected_proposals); END;
REVOKE ALL ON FUNCTION public.set_travel_profile_publication(uuid,boolean,bigint,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_travel_profile_publication(uuid,boolean,bigint,text[]) TO authenticated;

-- Explicit fifth argument: preserve existing four-argument callers without overload ambiguity.
CREATE FUNCTION public.editorial_company_page(p_status text,p_query text,p_page integer,p_sort text,p_view text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF p_status IS NOT NULL AND p_status NOT IN ('draft','pending','approved','rejected') THEN RAISE EXCEPTION 'invalid status'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR char_length(COALESCE(p_query,''))>200 OR p_sort IS NULL OR p_sort NOT IN ('name','submitted') OR p_view IS NULL OR p_view NOT IN ('all','new_imports','imports','published','withdrawn') THEN RAISE EXCEPTION 'invalid page'; END IF;
 WITH filtered AS MATERIALIZED (
 SELECT p.id,p.display_name,p.city,p.status,p.submitted_at,p.slug,c.legal_name,COALESCE(v.is_listed,true) is_listed,(i.profile_id IS NOT NULL) imported
 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
 LEFT JOIN public.company_profile_public_visibility v ON v.profile_id=p.id LEFT JOIN public.company_profile_imports i ON i.profile_id=p.id
 WHERE (p_status IS NULL OR p.status=p_status)
 AND (p_view='all' OR p_view='imports' AND i.profile_id IS NOT NULL OR p_view='new_imports' AND i.profile_id IS NOT NULL AND p.status<>'approved' OR p_view='published' AND p.status='approved' AND COALESCE(v.is_listed,true) OR p_view='withdrawn' AND p.status='approved' AND NOT COALESCE(v.is_listed,true))
 AND (COALESCE(p_query,'')='' OR p.display_name ILIKE '%'||p_query||'%' OR c.legal_name ILIKE '%'||p_query||'%' OR p.city ILIKE '%'||p_query||'%')
 ), page AS (SELECT * FROM filtered ORDER BY CASE WHEN p_sort='name' THEN lower(display_name) END,CASE WHEN p_sort='submitted' THEN submitted_at END NULLS LAST,id LIMIT 20 OFFSET (p_page-1)*20)
 SELECT jsonb_build_object('count',(SELECT count(*) FROM filtered),'profiles',COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY CASE WHEN p_sort='name' THEN lower(display_name) END,CASE WHEN p_sort='submitted' THEN submitted_at END NULLS LAST,id) FROM page),'[]'::jsonb)) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.editorial_company_page(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editorial_company_page(text,text,integer,text,text) TO authenticated;

-- Catalog predicates and Storage RLS remain identical. Compute matches once;
-- page BEFORE per-asset references/preview enrichment, rather than twice scanning.
CREATE OR REPLACE FUNCTION public.media_library_page(p_profile uuid DEFAULT NULL,p_kind text DEFAULT '',p_query text DEFAULT '',p_page integer DEFAULT 1,p_archived boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<1 OR p_page>100000 OR p_query IS NULL OR char_length(p_query)>200 OR p_kind IS NULL OR p_kind NOT IN ('','gallery','logo','contact','block','banner','video','images','unused') OR p_archived IS NULL THEN RAISE EXCEPTION 'invalid catalog query'; END IF;
 WITH matches AS MATERIALIZED (SELECT a.*,p.display_name profile_name FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id

 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile) OR EXISTS(SELECT 1 FROM public.company_ad_campaigns campaign JOIN public.media_library_files banner_file ON banner_file.bucket_id='ad-media' AND banner_file.storage_path=campaign.image_path WHERE banner_file.asset_id=a.id AND campaign.profile_id=p_profile)) AND ((a.archived_at IS NOT NULL)=p_archived)

 AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL) AND (a.deletion_requested_at IS NOT NULL OR a.bucket_id IN ('project-media','external-video') OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path) OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN storage.objects o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id)) AND (p_kind IN ('','unused') OR a.kind=p_kind OR p_kind='images' AND a.kind<>'video')

 AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')

 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0))),
 page AS MATERIALIZED (SELECT * FROM matches ORDER BY created_at DESC,id LIMIT 24 OFFSET (p_page-1)*24),
 enriched AS (
 SELECT (to_jsonb(a)-'profile_name')||jsonb_build_object('profile_name',a.profile_name,
 'preview_file',(SELECT jsonb_build_object('bucket',f.bucket_id,'path',f.storage_path) FROM public.media_library_files f WHERE f.asset_id=a.id AND (f.bucket_id='project-media' OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=f.bucket_id AND o.name=f.storage_path)) ORDER BY (f.context_key='original') DESC,f.storage_path LIMIT 1),
 'usages',COALESCE((SELECT jsonb_agg(u) FROM public.media_library_files f CROSS JOIN LATERAL jsonb_array_elements(public.media_library_asset_references(f.bucket_id,f.storage_path)) u WHERE f.asset_id=a.id),'[]'::jsonb)) item,a.created_at,a.id
 FROM page a)
 SELECT jsonb_build_object('count',(SELECT count(*) FROM matches),'items',COALESCE((SELECT jsonb_agg(item ORDER BY created_at DESC,id) FROM enriched),'[]'::jsonb)) INTO result;
 RETURN result;
END;
$$;
