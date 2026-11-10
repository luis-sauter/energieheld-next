-- Separate Reiseportal queue. Keep the original Energieheld queue and all data unchanged.
CREATE FUNCTION public.portal_editorial_work_queue(p_page integer DEFAULT 1,p_limit integer DEFAULT 8,p_kind text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_limit IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR p_limit NOT BETWEEN 1 AND 20
 OR (p_kind IS NOT NULL AND p_kind NOT IN ('profile','advertising')) THEN RAISE EXCEPTION 'invalid page'; END IF;
 WITH tasks AS (
  SELECT p.id,'profile'::text AS kind,p.display_name AS name,p.submitted_at,'pending'::text AS status,'/admin/firmen/'||p.id AS href
  FROM public.company_profiles p WHERE p.status='pending'
  UNION ALL
  SELECT c.id,'advertising',c.internal_name,c.submitted_at,coalesce(c.request_status,c.status),'/admin/werbung/'||c.id
  FROM public.company_ad_campaigns c
  WHERE c.archived_at IS NULL AND NOT c.is_editorial AND (c.status='pending' OR c.request_status IN ('new','in_progress'))
 ), counts AS (
  SELECT count(*) FILTER(WHERE kind='profile') AS profiles,count(*) FILTER(WHERE kind='advertising') AS advertising,
   0::bigint AS verifications,count(*) AS total FROM tasks
 )
 SELECT jsonb_build_object('counts',to_jsonb(counts),'tasks',coalesce(
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY submitted_at NULLS LAST,id,kind)
   FROM (SELECT * FROM tasks WHERE p_kind IS NULL OR kind=p_kind ORDER BY submitted_at NULLS LAST,id,kind
         LIMIT p_limit OFFSET (p_page-1)*p_limit) t),'[]'::jsonb))
 INTO result FROM counts;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.portal_editorial_work_queue(integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_editorial_work_queue(integer,integer,text) TO authenticated;
