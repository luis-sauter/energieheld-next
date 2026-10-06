-- Controlled general legacy creatives; evidence in audience-evidence-audit.
-- No inheritance across individual advertiser creatives.
BEGIN;
WITH proven(banner_key, advertiser_key, profile_slug, term_key) AS (VALUES
 ('legacy:https://annis-romantikhaeuschen.de/', 'domain:annis-romantikhaeuschen.de', 'anni-romantikhaeuschen', 'audience:paar'),
 ('legacy:https://hoeflehner.com/', 'domain:hoeflehner.com', 'hoeflehner', 'audience:familie'),
 ('legacy:https://hoeflehner.com/', 'domain:hoeflehner.com', 'hoeflehner', 'audience:mit-hund'),
 ('legacy:https://feldhof.com/', 'domain:feldhof.com', 'feldhof-dolcevita-resort', 'audience:familie'),
 ('legacy:https://feldhof.com/', 'domain:feldhof.com', 'feldhof-dolcevita-resort', 'audience:mit-hund'),
 ('legacy:https://feldhof.com/', 'domain:feldhof.com', 'feldhof-dolcevita-resort', 'audience:paar')
)
INSERT INTO public.ad_banner_search_terms (banner_key, term_key)
SELECT v.banner_key, v.term_key FROM proven v
JOIN public.ad_banner_search_metadata m ON m.banner_key=v.banner_key
 AND m.advertiser_key=v.advertiser_key AND m.primary_creative AND m.commercial
JOIN public.company_profiles p ON p.slug=v.profile_slug AND p.status='approved'
JOIN public.company_profile_travel_terms t ON t.profile_id=p.id AND t.term_key=v.term_key
ON CONFLICT (banner_key, term_key) DO NOTHING;
COMMIT;
