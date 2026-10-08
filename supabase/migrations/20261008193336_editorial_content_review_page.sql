-- Read-only editorial pagination. No table, policy, publication or data changes.
CREATE FUNCTION public.editorial_content_review_page(
  p_reviewed boolean DEFAULT false,
  p_page integer DEFAULT 1,
  p_now timestamptz DEFAULT statement_timestamp()
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  IF p_reviewed IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000
    OR p_now IS NULL OR NOT isfinite(p_now) THEN
    RAISE EXCEPTION 'invalid review page' USING ERRCODE='22023';
  END IF;
  WITH classified AS (
    SELECT p.id,p.display_name,p.city,f.profile_id,
      f.content_revision,f.content_updated_at,f.content_update_source,
      f.reviewed_revision,f.reviewed_at,f.review_invalidated_at,
      CASE
        WHEN f.reviewed_at IS NULL THEN 'Noch nicht geprüft'
        WHEN f.review_invalidated_at IS NOT NULL THEN 'Prüfung erforderlich'
        WHEN f.reviewed_revision IS DISTINCT FROM f.content_revision THEN 'Seit Prüfung geändert'
        -- JS Date has millisecond precision and adds a UTC calendar year,
        -- clamping February 29 to February 28. Equality is still reviewed.
        WHEN date_trunc('milliseconds',p_now) >
          ((date_trunc('milliseconds',f.reviewed_at AT TIME ZONE 'UTC') + interval '1 year') AT TIME ZONE 'UTC')
          THEN 'Prüfung überfällig'
        ELSE 'Aktuell geprüft'
      END AS review_status
    FROM public.company_profiles p
    LEFT JOIN public.profile_content_freshness f ON f.profile_id=p.id
    WHERE p.status='approved'
  ), filtered AS MATERIALIZED (
    SELECT * FROM classified WHERE (review_status='Aktuell geprüft')=p_reviewed
  ), page AS (
    SELECT * FROM filtered ORDER BY display_name,id LIMIT 20 OFFSET (p_page-1)*20
  )
  SELECT jsonb_build_object(
    'count',(SELECT count(*) FROM filtered),
    'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',id,'display_name',display_name,'city',city,'review_status',review_status,
      'freshness',CASE WHEN profile_id IS NULL THEN NULL ELSE jsonb_build_object(
        'content_revision',content_revision,'content_updated_at',content_updated_at,
        'content_update_source',content_update_source,'reviewed_revision',reviewed_revision,
        'reviewed_at',reviewed_at,'review_invalidated_at',review_invalidated_at
      ) END
    ) ORDER BY display_name,id) FROM page),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.editorial_content_review_page(boolean,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editorial_content_review_page(boolean,integer,timestamptz) TO authenticated;
