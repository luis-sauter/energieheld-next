-- Private owner input, deliberately excluded from public profile/search projections.
CREATE TABLE public.company_profile_editorial_notes (
  profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  owner_note text CHECK (char_length(owner_note) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_profile_editorial_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_editorial_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_profile_editorial_notes TO authenticated;
GRANT INSERT (profile_id, owner_note), UPDATE (profile_id, owner_note)
  ON public.company_profile_editorial_notes TO authenticated;

CREATE POLICY editorial_notes_owner_read ON public.company_profile_editorial_notes
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
));
CREATE POLICY editorial_notes_admin_read ON public.company_profile_editorial_notes
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid())
));
CREATE POLICY editorial_notes_owner_insert ON public.company_profile_editorial_notes
FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
));
CREATE POLICY editorial_notes_owner_update ON public.company_profile_editorial_notes
FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
)) WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
));

CREATE FUNCTION public.timestamp_editorial_note() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.timestamp_editorial_note() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER timestamp_editorial_note BEFORE UPDATE ON public.company_profile_editorial_notes
FOR EACH ROW EXECUTE FUNCTION public.timestamp_editorial_note();
