-- Prepared only. Cloud application requires separate incident approval.
-- Preserve the existing helper signature, owner, grants and every access predicate.
-- Select one campaign by its existing UUID primary key instead of building and
-- evaluating a separate path regex for every historical campaign.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_access_ad_media(p_path text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.company_ad_campaigns a
  LEFT JOIN public.company_profiles p ON p.id=a.profile_id
  LEFT JOIN public.companies c ON c.id=p.company_id
  WHERE a.id=CASE
    WHEN split_part(p_path,'/',2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_path,'/',2)::uuid ELSE NULL END
  AND p_path ~ '^campaigns/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/creative/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND CASE WHEN p_write THEN
    (a.archived_at IS NULL AND NOT a.is_editorial AND c.owner_user_id=auth.uid() AND a.status IN ('draft','rejected'))
    OR ((a.archived_at IS NULL OR (a.deletion_requested_at IS NOT NULL AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=p_path))) AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
  ELSE (NOT a.is_editorial AND c.owner_user_id=auth.uid())
    OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
    OR (a.image_path=p_path AND a.archived_at IS NULL AND a.status='approved'
      AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date)
  END);
$$;
COMMIT;
