-- Minimal local test fixture, not a reconstruction of historical migrations.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
CREATE TABLE public.portal_admins (user_id uuid PRIMARY KEY);
CREATE TABLE public.companies (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, legal_name text NOT NULL);
CREATE TABLE public.company_profiles (
  id uuid PRIMARY KEY, company_id uuid REFERENCES public.companies(id),
  display_name text NOT NULL, status text NOT NULL DEFAULT 'draft',
  approved_at timestamptz, submitted_at timestamptz
);
ALTER TABLE public.portal_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.companies, public.company_profiles TO authenticated;
GRANT SELECT (user_id) ON public.portal_admins TO authenticated;
GRANT UPDATE (display_name, status, submitted_at) ON public.company_profiles TO authenticated;
CREATE POLICY admins_self ON public.portal_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY companies_read ON public.companies FOR SELECT TO authenticated USING (
  owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
);
CREATE POLICY profiles_owner_read ON public.company_profiles FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.companies WHERE id=company_id AND owner_user_id=auth.uid())
);
CREATE POLICY profiles_public_read ON public.company_profiles FOR SELECT TO anon, authenticated USING (status='approved');
CREATE POLICY profiles_admin_read ON public.company_profiles FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
);
CREATE POLICY profiles_owner_update ON public.company_profiles FOR UPDATE TO authenticated USING (
  EXISTS(SELECT 1 FROM public.companies WHERE id=company_id AND owner_user_id=auth.uid())
) WITH CHECK (status IN ('draft','pending') AND EXISTS(
  SELECT 1 FROM public.companies WHERE id=company_id AND owner_user_id=auth.uid()
));
-- Signature only: migration under test supplies the hardened implementation.
CREATE FUNCTION public.review_company_profile(uuid,text) RETURNS text LANGUAGE sql AS $$ SELECT $2; $$;
REVOKE EXECUTE ON FUNCTION public.review_company_profile(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_company_profile(uuid,text) TO authenticated;
