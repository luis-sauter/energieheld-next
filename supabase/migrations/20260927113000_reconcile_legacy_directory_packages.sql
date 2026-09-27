-- Reconstruct the old public A-Z Complete/Basic presentation from 63 visible
-- Joomla rows, not from the presence of media or a commercial contract.
-- Source matrix: docs/reiseportal-legacy-az-source.json.
CREATE TABLE public.company_profile_directory_packages (
  profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  package text NOT NULL CHECK (package IN ('basic', 'premium')),
  legacy_joomla_article_id integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profile_directory_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_directory_packages FROM PUBLIC, anon, authenticated;
GRANT SELECT (profile_id, package, legacy_joomla_article_id, updated_at)
  ON public.company_profile_directory_packages TO anon, authenticated;
GRANT INSERT (profile_id, package, legacy_joomla_article_id),
  UPDATE (package, legacy_joomla_article_id, updated_at), DELETE
  ON public.company_profile_directory_packages TO authenticated;

CREATE POLICY directory_packages_public_read ON public.company_profile_directory_packages
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY directory_packages_admin_read ON public.company_profile_directory_packages
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY directory_packages_admin_insert ON public.company_profile_directory_packages
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY directory_packages_admin_update ON public.company_profile_directory_packages
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY directory_packages_admin_delete ON public.company_profile_directory_packages
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);

WITH source(slug, package, legacy_joomla_article_id) AS (
  VALUES
    ('alfseeferien-und-erlebnispark', 'basic', 474),
    ('alpenhotel-montafon', 'basic', 487),
    ('anni-romantikhaeuschen', 'premium', 450),
    ('apartbauernhof-valrunzhof', 'premium', 506),
    ('appartementhaus-salzburg', 'premium', 507),
    ('bayerischer-wald', 'premium', 443),
    ('blausee', 'premium', 473),
    ('camping-resort-allweglehen', 'premium', 467),
    ('city-apart-dresden', 'premium', 447),
    ('das-5-sterne-wellness-hotel-stock-resort', 'premium', 451),
    ('der-koenigsleitner-romantik-zu-zweit', 'premium', 504),
    ('familienhotel-und-kinderhotel-sonnwies', 'basic', 476),
    ('feelfree-nature-resort', 'basic', 488),
    ('feldhof-dolcevita-resort', 'premium', 460),
    ('ferienbauernhof-buechele', 'basic', 455),
    ('ferienwohnung-sieber', 'premium', 446),
    ('golf-und-sporthotel-hof-maran', 'basic', 483),
    ('golfhotel-andreus', 'premium', 452),
    ('haus-terra-ferienwohnung', 'basic', 490),
    ('hoeflehner', 'premium', 464),
    ('hotel-godewind', 'basic', 494),
    ('hotel-mondschein', 'basic', 489),
    ('hotel-ravelli-luxury-spa', 'premium', 505),
    ('hotel-salzburger-hof', 'premium', 502),
    ('hotel-zur-post', 'premium', 457),
    ('jaegeralpe', 'premium', 463),
    ('kaiser-hans-natur-residence', 'basic', 481),
    ('kemmeriboden-bad', 'premium', 472),
    ('kesselgrub', 'basic', 485),
    ('kronplatz', 'basic', 477),
    ('laerchenhof', 'basic', 491),
    ('landgasthof-neue-schaenke', 'premium', 442),
    ('landgut-ramshof', 'basic', 498),
    ('landhotel-talblick', 'basic', 492),
    ('lindner-hotel-koeln-city-plaza', 'basic', 496),
    ('mintrops-land-hotel', 'basic', 499),
    ('oewers-wellness-und-spa-hotel', 'basic', 493),
    ('ostsee-barfusspark', 'premium', 449),
    ('oversum-vital-resort-im-hochsauerland', 'premium', 453),
    ('pension-sonnenhof', 'premium', 470),
    ('pension-steingarten', 'basic', 479),
    ('platzl-hotel', 'premium', 456),
    ('pletzer-resorts-bayrischzell', 'basic', 497),
    ('rhoen-park-aktiv-resort', 'basic', 500),
    ('rue-blanch', 'premium', 471),
    ('schafhuber', 'premium', 465),
    ('schlosshotel-ralswiek', 'basic', 495),
    ('schwarzwaelderhof', 'premium', 469),
    ('small-und-beautiful-hotel-gnaid', 'basic', 484),
    ('stroblhof', 'basic', 478),
    ('sub-aqua-tauchreisen', 'premium', 459),
    ('the-chedi', 'premium', 466),
    ('urlaub-auf-borkum', 'premium', 448),
    ('villner-hof', 'basic', 480),
    ('wellnesshotel-almhof-call', 'basic', 501),
    ('wellnesshotel-golfpanorama', 'basic', 482),
    ('wirodive-tauchreisen', 'premium', 458),
    ('wirthshof', 'premium', 468)
)
INSERT INTO public.company_profile_directory_packages (profile_id, package, legacy_joomla_article_id)
SELECT p.id, source.package, source.legacy_joomla_article_id
FROM source JOIN public.company_profiles p ON p.slug = source.slug AND p.status = 'approved';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.company_profile_directory_packages) <> 58
     OR (SELECT count(*) FROM public.company_profile_directory_packages WHERE package = 'premium') <> 31
     OR (SELECT count(*) FROM public.company_profile_directory_packages WHERE package = 'basic') <> 27 THEN
    RAISE EXCEPTION 'Legacy A-Z package mapping incomplete';
  END IF;
END;
$$;
