-- Read-only public projection. The existing provenance table stays admin-only.
-- Explicit visibility checks are required because this function reads as its owner.
CREATE FUNCTION public.public_company_import_markers(p_profile_ids uuid[])
RETURNS TABLE(profile_id uuid, imported_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.profile_id, i.imported_at
  FROM public.company_profile_imports i
  JOIN public.company_profiles p ON p.id = i.profile_id
  WHERE cardinality(p_profile_ids) BETWEEN 1 AND 500
    AND i.profile_id = ANY(p_profile_ids)
    AND p.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.company_profile_public_visibility v
      WHERE v.profile_id = p.id AND v.is_listed = false
    )
  ORDER BY i.profile_id;
$$;
REVOKE ALL ON FUNCTION public.public_company_import_markers(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_company_import_markers(uuid[]) TO anon, authenticated;
COMMENT ON FUNCTION public.public_company_import_markers(uuid[]) IS
  'Read-only import marker/date for explicitly requested public approved profiles; no source URLs, notes, drafts or archived profiles.';
