-- The public Joomla A-Z list contains both providers twice: 507/454 and
-- 502/503. The former public Complete record supplies the canonical profile;
-- the Basic/second Complete record contributes only its proven theme labels.
-- Evidence: docs/reiseportal-legacy-az-source.json and normalized/companies.json.
DO $$
DECLARE
  v_company uuid;
  v_profile uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_profiles
             WHERE slug IN ('appartementhaus-salzburg', 'hotel-salzburger-hof')) THEN
    RAISE EXCEPTION 'A-Z provider already exists; review before importing';
  END IF;

  INSERT INTO public.companies (owner_user_id, legal_name, contact_email)
  VALUES (NULL, 'Appartementhaus Salzburg', 'info@haus-salzburg.de')
  RETURNING id INTO v_company;
  INSERT INTO public.company_profiles
    (company_id, slug, display_name, description, business_areas, street,
     postal_code, city, country, phone, public_email, website, status, approved_at)
  VALUES
    (v_company, 'appartementhaus-salzburg', 'Appartementhaus Salzburg',
     'Ein herzliches „Grüß Gott“ aus Bad Füssing! Willkommen im Appartementhaus Salzburg. Schön, dass Sie da sind.',
     'Natur pur, Nordic Walking, Radwandern, Wanderurlaub',
     'Prof.-Böhm-Straße 7', '94072', 'Bad Füssing', 'Deutschland',
     '+49 8531 27070', 'info@haus-salzburg.de', 'https://haus-salzburg.de/',
     'approved', now())
  RETURNING id INTO v_profile;
  INSERT INTO public.company_profile_travel_terms (profile_id, term_key)
  VALUES (v_profile, 'theme:natur-pur'),
         (v_profile, 'theme:nordic-walking'),
         (v_profile, 'theme:radwandern'),
         (v_profile, 'theme:wanderurlaub');

  INSERT INTO public.companies (owner_user_id, legal_name, contact_email)
  VALUES (NULL, 'Hotel Salzburger Hof', 'hotel@salzburger-hof.at')
  RETURNING id INTO v_company;
  INSERT INTO public.company_profiles
    (company_id, slug, display_name, description, business_areas, street,
     postal_code, city, country, phone, public_email, website, status, approved_at)
  VALUES
    (v_company, 'hotel-salzburger-hof', 'Hotel Salzburger Hof',
     'Urlaub mit der ganzen Familie in Dienten am Hochkönig - Familienhotel im Salzburger Land',
     'Familienurlaub, Wanderurlaub',
     'Dorf 6', '5652', 'Dienten am Hockönig', 'Österreich',
     '+43 6461 2170', 'hotel@salzburger-hof.at', 'https://www.salzburger-hof.at',
     'approved', now())
  RETURNING id INTO v_profile;
  INSERT INTO public.company_profile_travel_terms (profile_id, term_key)
  VALUES (v_profile, 'theme:familienurlaub'),
         (v_profile, 'theme:wanderurlaub');
END;
$$;
