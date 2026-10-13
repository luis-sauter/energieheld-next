# Seasonal recommendations

Seasonal assignments reuse `travel_terms` and `company_profile_travel_terms`:
`theme:saison-fruehling`, `theme:saison-sommer`, `theme:saison-herbst`,
`theme:saison-winter`. They are displayed as a separate **Jahreszeiten** group
in the existing admin travel picker, not added to the fixed Mottoreisen menu.
Each assignment can have a nullable `seasonal_teaser` of at most 240 characters.
Main profile descriptions, galleries and publication states remain independent.

The existing profile Save persists selected keys and seasonal texts together
through `save_profile_travel_seasons`. This authenticated, admin-checked invoker
RPC reuses the original assignment save and its profile/freshness locks,
expected terms, proposals and revision. The historical five-argument save is
preserved. Teaser changes participate in existing content freshness: they can
make an editorial review stale, without changing publication or approving it.
Updates grant only the new column and require existing portal admin membership.
Public reads retain the existing assignment RLS; archived approved metadata may
still be API-readable under historical rules. Public results continue to use
the approved/listed travel index, excluding drafts and archived companies.

`TravelSeasons` replaces only the homepage destination-card section. It computes
meteorological seasons with `Europe/Berlin` on the server, without a database
call or client clock. The current season appears first; all four remain linked
to `/unterkuenfte-a-z?thema=saison-*`. Existing exact taxonomy filtering and
`search_public_portal_v2` handle these values before counts/pagination; no SQL
search/ranking change, keyword inference or parallel results component is used.
Rows reuse the A–Z component and stylesheet, displaying the selected seasonal
teaser in addition to the unchanged profile summary. News, banner slots and
destination routes remain separate.

Images reuse the existing editorial Natur-pur, Urlaub-am-Wasser and Radwandern
assets (provenance: `public/reiseportal/motto-editorial-v2/manifest.json`), plus
the existing Joomla wellness symbol photo for winter relaxation. No new images,
generation, storage upload or provider-photo substitution is introduced.

Deployment order: separately approved migration
`20261013160000_company_travel_seasons.sql`, reviewed one-shot assignment seed,
then feature-branch preview. The seed must reject changed public source content
and existing season decisions; never replay it over later editorial work.
Season recommendations do not guarantee opening dates, weather, included
services or booking availability. Those remain subject to each provider's
current conditions.
