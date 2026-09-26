-- The public profile and map use the verified address of an approved stay.
-- Row visibility remains governed by company_profiles_public_read_approved.
GRANT SELECT (street) ON public.company_profiles TO anon, authenticated;
