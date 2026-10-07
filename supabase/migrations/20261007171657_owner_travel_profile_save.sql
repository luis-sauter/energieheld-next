-- Controlled vocabulary is readable by owners, even before its first public use.
CREATE POLICY travel_terms_owner_vocabulary ON public.travel_terms
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.companies c WHERE c.owner_user_id = (SELECT auth.uid())
));
CREATE POLICY profile_travel_terms_owner_read ON public.company_profile_travel_terms
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
));
CREATE POLICY profile_travel_terms_owner_insert ON public.company_profile_travel_terms
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
      AND p.status IN ('draft', 'pending', 'rejected'))
  AND (term_key LIKE 'theme:%' OR term_key LIKE 'accommodation:%'
    OR term_key IN ('audience:mit-hund', 'audience:familie', 'audience:paar'))
);
CREATE POLICY profile_travel_terms_owner_delete ON public.company_profile_travel_terms
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid())
      AND p.status IN ('draft', 'pending', 'rejected'))
  AND (term_key LIKE 'theme:%' OR term_key LIKE 'accommodation:%'
    OR term_key IN ('audience:mit-hund', 'audience:familie', 'audience:paar'))
);

-- One transaction, no caller-supplied profile ID, no status/ownership changes.
CREATE FUNCTION public.save_own_travel_profile(fields jsonb, selected_terms text[], expected_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  own_profile public.company_profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT p.* INTO STRICT own_profile FROM public.company_profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE c.owner_user_id = auth.uid() FOR UPDATE OF p;
  IF own_profile.status <> expected_status THEN RAISE EXCEPTION 'Profile changed'; END IF;
  IF jsonb_typeof(fields) <> 'object' OR fields IS NULL
    OR nullif(btrim(fields->>'display_name'), '') IS NULL
    OR EXISTS (SELECT 1 FROM jsonb_each(fields) f WHERE f.key <> ALL(ARRAY[
      'display_name','business_areas','tagline','description','phone','public_email','website',
      'street','postal_code','city','region','country','contact_first_name','contact_last_name'])
      OR jsonb_typeof(f.value) NOT IN ('string','null'))
    OR char_length(fields->>'contact_first_name') > 120 OR char_length(fields->>'contact_last_name') > 120
  THEN RAISE EXCEPTION 'Invalid profile fields'; END IF;
  IF selected_terms IS NOT NULL AND own_profile.status = 'approved' THEN
    RAISE EXCEPTION 'Approved classifications are editorial' USING ERRCODE = '42501';
  END IF;
  IF selected_terms IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(selected_terms) k WHERE k IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.travel_terms t WHERE t.term_key = k
        AND (t.dimension IN ('theme','accommodation')
          OR t.term_key IN ('audience:mit-hund','audience:familie','audience:paar'))
    )
  ) THEN RAISE EXCEPTION 'Invalid travel terms'; END IF;

  UPDATE public.company_profiles SET
    display_name = fields->>'display_name', business_areas = fields->>'business_areas',
    tagline = fields->>'tagline', description = fields->>'description',
    phone = fields->>'phone', public_email = fields->>'public_email', website = fields->>'website',
    street = fields->>'street', postal_code = fields->>'postal_code', city = fields->>'city', region = fields->>'region',
    country = CASE WHEN fields ? 'country' THEN fields->>'country' ELSE own_profile.country END,
    contact_first_name = CASE WHEN fields ? 'contact_first_name' THEN fields->>'contact_first_name' ELSE own_profile.contact_first_name END,
    contact_last_name = CASE WHEN fields ? 'contact_last_name' THEN fields->>'contact_last_name' ELSE own_profile.contact_last_name END
  WHERE id = own_profile.id;
  IF selected_terms IS NOT NULL THEN
    DELETE FROM public.company_profile_travel_terms x WHERE x.profile_id = own_profile.id
      AND x.term_key IN (SELECT t.term_key FROM public.travel_terms t
        WHERE t.dimension IN ('theme','accommodation')
          OR t.term_key IN ('audience:mit-hund','audience:familie','audience:paar'))
      AND NOT (x.term_key = ANY(selected_terms));
    INSERT INTO public.company_profile_travel_terms (profile_id,term_key)
      SELECT own_profile.id,k FROM (SELECT DISTINCT unnest(selected_terms) k) choices
      ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_own_travel_profile(jsonb,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_own_travel_profile(jsonb,text[],text) TO authenticated;
