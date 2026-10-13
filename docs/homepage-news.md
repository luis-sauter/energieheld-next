# Homepage travel news

`src/data/travel-news.ts` is the manually reviewed, ordered selection. Exactly three entries render through `TravelNews`: the first is the lead, followed by two smaller cards. Titles, short original teasers, source URLs, source dates, review dates and image references remain together.

Sources checked on 13 October 2026:

- Gasteinertal Tourismus, 18 August 2026: autumn mountain walks and the two thermal spas. No medical promises or expired event dates are reproduced.
- ADAC Südbayern / PiNCAMP, 17 September 2026: average Bavarian off-season camping prices are ten percent below the high season. These are reported seasonal averages, not live booking offers.
- Zell-Gerlos on Presse.Tirol, updated 11 August 2026: autumn family recreation. Events and attractions whose season already ended are not advertised as currently open.

All cards link directly to their independently verified original sources, in new tabs with `noopener noreferrer`. There is no article index or internal article route.

The three pictures are expressly authorized AI-generated symbolic illustrations, not photographs of those destinations, hotels or events. Their provenance and full prompts are in `public/reiseportal/news/manifest.json`. Existing assets remain untouched. Local WebP compression and lazy delivery avoid Storage reads and dynamic image transformations.

CSS uses one two-column, two-row grid; the lead spans both rows. Content determines the shared height, without clipping text. Below 760px the cards stack naturally.

A future proposal feed can produce this same data shape for editorial review. Only approved records should replace the static selection at build time. No runtime feed requests, database tables, scheduled jobs or automatic publication exist in this version. Check source facts and seasonal validity when manually refreshing the selection.
