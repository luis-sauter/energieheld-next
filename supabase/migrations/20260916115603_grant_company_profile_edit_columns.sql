-- Existing ownership/status RLS remains authoritative. No IDs, slug or
-- approval timestamps can be changed with these column privileges.
GRANT UPDATE (
  display_name, tagline, description, phone, public_email, website,
  street, postal_code, city, region, status, submitted_at
) ON public.company_profiles TO authenticated;
