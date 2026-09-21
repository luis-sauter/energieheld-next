-- Row visibility remains governed by company_profiles_public_read_approved.
GRANT SELECT (
  id, status, slug, display_name, tagline, description, phone, public_email,
  website, postal_code, city, region, country, logo_url, business_areas
) ON public.company_profiles TO anon;
