-- Controlled Reiseportal vocabulary. Terms are public labels; profile assignments
-- remain visible only while the associated profile is approved.
CREATE TABLE public.travel_terms (
  term_key text PRIMARY KEY,
  dimension text NOT NULL CHECK (dimension IN ('theme', 'audience', 'accommodation', 'feature')),
  slug text NOT NULL,
  label text NOT NULL,
  UNIQUE (dimension, slug),
  CHECK (term_key = dimension || ':' || slug)
);

CREATE TABLE public.company_profile_travel_terms (
  profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  term_key text NOT NULL REFERENCES public.travel_terms(term_key),
  PRIMARY KEY (profile_id, term_key)
);
CREATE INDEX company_profile_travel_terms_lookup_idx
  ON public.company_profile_travel_terms (term_key, profile_id);

-- Joomla has no structured audience, accommodation or amenity assignments for
-- these records. Create the requested editorial vocabulary, but leave features
-- empty until a specific source has been checked by an editor.
INSERT INTO public.travel_terms (term_key, dimension, slug, label) VALUES
  ('theme:natur-pur', 'theme', 'natur-pur', 'Natur'),
  ('theme:nordic-walking', 'theme', 'nordic-walking', 'Nordic Walking'),
  ('theme:radwandern', 'theme', 'radwandern', 'Radwandern'),
  ('theme:wanderurlaub', 'theme', 'wanderurlaub', 'Wandern'),
  ('theme:familienurlaub', 'theme', 'familienurlaub', 'Familie'),
  ('theme:golfurlaub', 'theme', 'golfurlaub', 'Golf'),
  ('theme:tauchurlaub', 'theme', 'tauchurlaub', 'Tauchen'),
  ('theme:urlaub-am-wasser', 'theme', 'urlaub-am-wasser', 'Urlaub am Wasser'),
  ('theme:campingurlaub', 'theme', 'campingurlaub', 'Camping'),
  ('theme:romantik-zu-zweit', 'theme', 'romantik-zu-zweit', 'Romantik'),
  ('theme:wellnessangebote', 'theme', 'wellnessangebote', 'Wellness'),
  ('theme:geschaeftsreisen', 'theme', 'geschaeftsreisen', 'Geschäftsreisen'),
  ('audience:paar', 'audience', 'paar', 'Paar'),
  ('audience:familie', 'audience', 'familie', 'Familie'),
  ('audience:mit-hund', 'audience', 'mit-hund', 'Mit Hund'),
  ('audience:gruppe', 'audience', 'gruppe', 'Gruppe'),
  ('accommodation:hotel', 'accommodation', 'hotel', 'Hotel'),
  ('accommodation:ferienwohnung', 'accommodation', 'ferienwohnung', 'Ferienwohnung'),
  ('accommodation:pension', 'accommodation', 'pension', 'Pension'),
  ('accommodation:camping', 'accommodation', 'camping', 'Camping');

-- These 23 assignments come from Joomla's structured category-bd values in
-- .legacy-reiseportal/raw/articles.json (articles 443, 464, 470, 465,
-- 480, 458, 468, 450, 457 and 452 respectively). No audience, accommodation
-- or feature assignment is inferred from prose or business names.
INSERT INTO public.company_profile_travel_terms (profile_id, term_key)
SELECT p.id, source.term_key
FROM (VALUES
  ('bayerischer-wald', 'theme:natur-pur'),
  ('bayerischer-wald', 'theme:nordic-walking'),
  ('bayerischer-wald', 'theme:wanderurlaub'),
  ('hoeflehner', 'theme:nordic-walking'),
  ('hoeflehner', 'theme:wanderurlaub'),
  ('hoeflehner', 'theme:familienurlaub'),
  ('hoeflehner', 'theme:wellnessangebote'),
  ('pension-sonnenhof', 'theme:nordic-walking'),
  ('pension-sonnenhof', 'theme:radwandern'),
  ('schafhuber', 'theme:nordic-walking'),
  ('schafhuber', 'theme:wanderurlaub'),
  ('villner-hof', 'theme:natur-pur'),
  ('villner-hof', 'theme:nordic-walking'),
  ('villner-hof', 'theme:radwandern'),
  ('villner-hof', 'theme:wanderurlaub'),
  ('wirodive-tauchreisen', 'theme:tauchurlaub'),
  ('wirthshof', 'theme:urlaub-am-wasser'),
  ('wirthshof', 'theme:campingurlaub'),
  ('anni-romantikhaeuschen', 'theme:romantik-zu-zweit'),
  ('anni-romantikhaeuschen', 'theme:wanderurlaub'),
  ('hotel-zur-post', 'theme:geschaeftsreisen'),
  ('golfhotel-andreus', 'theme:golfurlaub'),
  ('golfhotel-andreus', 'theme:wellnessangebote')
) AS source(profile_slug, term_key)
JOIN public.company_profiles p ON p.slug = source.profile_slug AND p.status = 'approved';

ALTER TABLE public.travel_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profile_travel_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.travel_terms, public.company_profile_travel_terms FROM PUBLIC, anon, authenticated;
GRANT SELECT (term_key, dimension, slug, label) ON public.travel_terms TO anon, authenticated;
GRANT SELECT (profile_id, term_key) ON public.company_profile_travel_terms TO anon, authenticated;
GRANT INSERT (profile_id, term_key), DELETE ON public.company_profile_travel_terms TO authenticated;

CREATE POLICY travel_terms_public_read ON public.travel_terms
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profile_travel_terms x
    JOIN public.company_profiles p ON p.id = x.profile_id
    WHERE x.term_key = travel_terms.term_key AND p.status = 'approved')
);
CREATE POLICY travel_terms_admin_read ON public.travel_terms
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY profile_travel_terms_public_read ON public.company_profile_travel_terms
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY profile_travel_terms_admin_read ON public.company_profile_travel_terms
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY profile_travel_terms_admin_insert ON public.company_profile_travel_terms
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id)
);
CREATE POLICY profile_travel_terms_admin_delete ON public.company_profile_travel_terms
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
