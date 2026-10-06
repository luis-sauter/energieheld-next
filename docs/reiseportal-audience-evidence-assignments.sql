BEGIN;
SET LOCAL app.content_update_source = 'import';
WITH evidence(profile_id,slug,term_key) AS (VALUES
('49b2316e-dd69-4d68-9f10-b7fc86100cf8','pension-sonnenhof','audience:mit-hund'),
('14db48c3-57b8-4146-9e3b-f0c567b422f3','das-5-sterne-wellness-hotel-stock-resort','audience:mit-hund'),
('9423ff5a-4c63-47e6-86d2-64c1ecec4898','hotel-ravelli-luxury-spa','audience:mit-hund'),
('72312763-41f2-4adb-aaf2-de47b705a714','blausee','audience:mit-hund'),
('e018e81d-e3c3-4a88-8713-fd3d2a4ad2dd','platzl-hotel','audience:mit-hund'),
('b9594b15-178c-4ba1-b28d-ea129907ec63','wirthshof','audience:mit-hund'),
('b9594b15-178c-4ba1-b28d-ea129907ec63','wirthshof','audience:familie'),
('080f5336-ecbf-402c-a28f-1fbc16a30313','hoeflehner','audience:mit-hund'),
('f70f270c-3d10-4d21-ba6e-9e381f877c72','feldhof-dolcevita-resort','audience:mit-hund'),
('f70f270c-3d10-4d21-ba6e-9e381f877c72','feldhof-dolcevita-resort','audience:paar'),
('ac51f96a-1770-44b7-b397-0347e21fb890','golfhotel-andreus','audience:mit-hund'),
('ac51f96a-1770-44b7-b397-0347e21fb890','golfhotel-andreus','audience:familie'),
('c5d09fb2-888c-4ada-a6fb-1bf03655ed64','kemmeriboden-bad','audience:mit-hund'),
('8d709f0a-46fd-41e8-b9cf-1d9a37768a46','camping-resort-allweglehen','audience:mit-hund'),
('62cc488e-5bf4-4f94-aec7-ea1f5f9b00f0','hotel-zur-post','audience:mit-hund'),
('92256160-1734-4079-8ddf-07cacdc5da50','the-chedi','audience:mit-hund')
)
INSERT INTO public.company_profile_travel_terms(profile_id,term_key)
SELECT p.id,t.term_key FROM evidence e
JOIN public.company_profiles p ON p.id=e.profile_id::uuid AND p.slug=e.slug AND p.status='approved'
JOIN public.travel_terms t ON t.term_key=e.term_key AND t.dimension='audience'
ON CONFLICT (profile_id,term_key) DO NOTHING;
COMMIT;
