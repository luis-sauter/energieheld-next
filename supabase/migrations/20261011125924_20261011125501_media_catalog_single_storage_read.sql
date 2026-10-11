-- Preserve the catalog contract, SECURITY INVOKER and all existing grants/RLS.
-- Filter candidates first and evaluate Storage SELECT policies once per requested file.
CREATE OR REPLACE FUNCTION public.media_library_page(p_profile uuid DEFAULT NULL::uuid, p_kind text DEFAULT ''::text, p_query text DEFAULT ''::text, p_page integer DEFAULT 1, p_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<1 OR p_page>100000 OR p_query IS NULL OR char_length(p_query)>200 OR p_kind IS NULL OR p_kind NOT IN ('','gallery','logo','contact','block','banner','video','images','unused') OR p_archived IS NULL THEN RAISE EXCEPTION 'invalid catalog query'; END IF;

 WITH candidates AS MATERIALIZED (
 SELECT a.*,p.display_name profile_name FROM public.media_library_assets a LEFT JOIN public.company_profiles p ON p.id=a.profile_id
 WHERE (p_profile IS NULL OR a.profile_id=p_profile OR EXISTS(SELECT 1 FROM public.media_library_files context_file WHERE context_file.asset_id=a.id AND context_file.profile_id=p_profile) OR EXISTS(SELECT 1 FROM public.company_ad_campaigns campaign JOIN public.media_library_files banner_file ON banner_file.bucket_id='ad-media' AND banner_file.storage_path=campaign.image_path WHERE banner_file.asset_id=a.id AND campaign.profile_id=p_profile))
 AND ((a.archived_at IS NOT NULL)=p_archived) AND a.deleted_at IS NULL AND (p_archived OR a.deletion_requested_at IS NULL)
 AND (p_kind IN ('','unused') OR a.kind=p_kind OR p_kind='images' AND a.kind<>'video')
 AND (p_query='' OR concat_ws(' ',a.name,a.description,a.alt_text,p.display_name) ILIKE '%'||p_query||'%')
), requested_files AS MATERIALIZED (
 SELECT a.bucket_id,a.storage_path FROM candidates a WHERE a.bucket_id IN ('company-media','ad-media','company-profile-videos')
 UNION SELECT f.bucket_id,f.storage_path FROM public.media_library_files f JOIN candidates a ON a.id=f.asset_id WHERE f.bucket_id IN ('company-media','ad-media','company-profile-videos')
), readable_storage AS MATERIALIZED (
 SELECT o.bucket_id,o.name FROM storage.objects o JOIN requested_files f ON f.bucket_id=o.bucket_id AND f.storage_path=o.name
), matches AS MATERIALIZED (
 SELECT a.* FROM candidates a
 WHERE (a.deletion_requested_at IS NOT NULL OR a.bucket_id IN ('project-media','external-video')
 OR EXISTS(SELECT 1 FROM readable_storage o WHERE o.bucket_id=a.bucket_id AND o.name=a.storage_path)
 OR EXISTS(SELECT 1 FROM public.media_library_files f JOIN readable_storage o ON o.bucket_id=f.bucket_id AND o.name=f.storage_path WHERE f.asset_id=a.id))
 AND (p_kind<>'unused' OR NOT EXISTS(SELECT 1 FROM public.media_library_files f WHERE f.asset_id=a.id AND jsonb_array_length(public.media_library_asset_references(f.bucket_id,f.storage_path))>0))
), page AS MATERIALIZED (SELECT * FROM matches ORDER BY created_at DESC,id LIMIT 24 OFFSET (p_page-1)*24),
 enriched AS (
 SELECT (to_jsonb(a)-'profile_name')||jsonb_build_object('profile_name',a.profile_name,
 'preview_file',(SELECT jsonb_build_object('bucket',f.bucket_id,'path',f.storage_path) FROM public.media_library_files f WHERE f.asset_id=a.id AND (f.bucket_id='project-media' OR EXISTS(SELECT 1 FROM readable_storage o WHERE o.bucket_id=f.bucket_id AND o.name=f.storage_path)) ORDER BY (f.context_key='original') DESC,f.storage_path LIMIT 1),
 'usages',COALESCE((SELECT jsonb_agg(u) FROM public.media_library_files f CROSS JOIN LATERAL jsonb_array_elements(public.media_library_asset_references(f.bucket_id,f.storage_path)) u WHERE f.asset_id=a.id),'[]'::jsonb)) item,a.created_at,a.id FROM page a)
 SELECT jsonb_build_object('count',(SELECT count(*) FROM matches),'items',COALESCE((SELECT jsonb_agg(item ORDER BY created_at DESC,id) FROM enriched),'[]'::jsonb)) INTO result;
 RETURN result;
END;
$function$;
