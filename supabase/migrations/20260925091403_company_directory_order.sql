-- Directory order is separate from owner-editable company profile content.
CREATE TABLE public.company_directory_order (
  profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.company_directory_order (profile_id, sort_order)
SELECT id, (row_number() OVER (ORDER BY id) - 1)::integer
FROM public.company_profiles
WHERE status = 'approved';

ALTER TABLE public.company_directory_order ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_directory_order FROM PUBLIC, anon, authenticated;
GRANT SELECT (profile_id, sort_order, updated_at) ON public.company_directory_order TO anon, authenticated;
GRANT INSERT (profile_id, sort_order) ON public.company_directory_order TO authenticated;
GRANT UPDATE (sort_order, updated_at) ON public.company_directory_order TO authenticated;

CREATE POLICY directory_order_public_read ON public.company_directory_order
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY directory_order_admin_read ON public.company_directory_order
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY directory_order_admin_insert ON public.company_directory_order
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY directory_order_admin_update ON public.company_directory_order
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);

CREATE FUNCTION public.reorder_company_directory_profiles(p_profile_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Lock in a stable order. Concurrent reorders then validate and write serially.
  PERFORM 1 FROM public.company_profiles p
    WHERE p.status = 'approved' ORDER BY p.id FOR UPDATE OF p;

  IF p_profile_ids IS NULL
    OR cardinality(p_profile_ids) <> (
      SELECT count(*) FROM public.company_profiles WHERE status = 'approved')
    OR cardinality(p_profile_ids) <> (
      SELECT count(DISTINCT id) FROM unnest(p_profile_ids) AS t(id))
    OR EXISTS (
      SELECT 1 FROM unnest(p_profile_ids) AS t(id)
      WHERE t.id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.company_profiles p
        WHERE p.id = t.id AND p.status = 'approved')
    ) THEN
    RAISE EXCEPTION 'directory changed; reload' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.company_directory_order (profile_id, sort_order)
  SELECT t.id, t.ordinality::integer - 1
  FROM unnest(p_profile_ids) WITH ORDINALITY AS t(id, ordinality)
  ON CONFLICT (profile_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_company_directory_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_company_directory_profiles(uuid[]) TO authenticated;
