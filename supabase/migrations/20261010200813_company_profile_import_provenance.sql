-- Administrative provenance only. No profile/media/status changes or public exposure.
CREATE TABLE public.company_profile_imports (
  profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id),
  source_url text NOT NULL CHECK (length(source_url) <= 1000 AND source_url ~ '^https://[^[:space:]]+$'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 4000)
);
ALTER TABLE public.company_profile_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_imports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_profile_imports TO authenticated;
CREATE POLICY company_profile_imports_admin_read ON public.company_profile_imports
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid())));
CREATE POLICY company_profile_imports_admin_insert ON public.company_profile_imports
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid())));
CREATE POLICY company_profile_imports_admin_update ON public.company_profile_imports
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid())));
COMMENT ON TABLE public.company_profile_imports IS 'Admin-only import provenance. Publication is governed independently by company_profiles status and existing RLS.';
