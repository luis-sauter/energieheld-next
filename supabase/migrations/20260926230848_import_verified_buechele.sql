-- Joomla article 455 is published and supplies the provider name, address, phone
-- and structured themes. Published Joomla banners 353/354/397/398 identify its
-- website; the provider's own site confirms the same address and phone.
-- No description, email or profile image is inferred from the banners.
DO $$
DECLARE
  v_company_id uuid;
  v_profile_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_profiles WHERE slug = 'ferienbauernhof-buechele') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_profiles p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.slug = 'ferienbauernhof-buechele'
        AND p.display_name = 'Ferienbauernhof Büchele'
        AND p.street = 'Schmalenberg 15'
        AND p.postal_code = '79875'
        AND p.city = 'Dachsberg'
        AND p.phone = '+49 7672/2274'
        AND p.website = 'https://www.ferienbauernhof-buechele.de/'
        AND p.status = 'approved'
        AND c.owner_user_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Slug ferienbauernhof-buechele already belongs to different data';
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE (p.postal_code = '79875' AND
      right(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), 8) = '76722274')
      OR lower(coalesce(p.website, '')) LIKE '%ferienbauernhof-buechele.de%'
  ) THEN
    RAISE EXCEPTION 'Ferienbauernhof Büchele already has a profile under another slug';
  END IF;

  IF (
    SELECT count(*) FROM public.travel_terms
    WHERE term_key IN (
      'theme:natur-pur', 'theme:nordic-walking', 'theme:radwandern',
      'theme:wanderurlaub', 'theme:familienurlaub', 'audience:familie'
    )
  ) <> 6 THEN
    RAISE EXCEPTION 'Expected existing travel terms for Joomla article 455';
  END IF;

  INSERT INTO public.companies(owner_user_id, legal_name, contact_email)
  VALUES (NULL, 'Ferienbauernhof Büchele', NULL)
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_profiles(
    company_id, slug, display_name, description, business_areas, street,
    postal_code, city, region, country, phone, public_email, website,
    status, approved_at
  ) VALUES (
    v_company_id, 'ferienbauernhof-buechele', 'Ferienbauernhof Büchele', NULL,
    'Natur pur, Nordic Walking, Radwandern, Wanderurlaub, Familienurlaub',
    'Schmalenberg 15', '79875', 'Dachsberg', NULL, 'Deutschland',
    '+49 7672/2274', NULL, 'https://www.ferienbauernhof-buechele.de/',
    'approved', now()
  ) RETURNING id INTO v_profile_id;

  INSERT INTO public.company_profile_travel_terms(profile_id, term_key)
  SELECT v_profile_id, term_key FROM public.travel_terms
  WHERE term_key IN (
    'theme:natur-pur', 'theme:nordic-walking', 'theme:radwandern',
    'theme:wanderurlaub', 'theme:familienurlaub', 'audience:familie'
  );
END $$;
