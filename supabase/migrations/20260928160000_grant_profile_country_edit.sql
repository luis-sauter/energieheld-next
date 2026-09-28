-- The inline profile editor already shows country. Keep the existing owner/admin
-- UPDATE RLS as the authority; only permit this one existing column to be saved.
GRANT UPDATE (country) ON public.company_profiles TO authenticated;
