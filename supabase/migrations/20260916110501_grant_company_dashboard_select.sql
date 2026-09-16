-- RLS continues to restrict company and profile access to authorized rows.
GRANT SELECT ON public.companies, public.company_profiles TO authenticated;
