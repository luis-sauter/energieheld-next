# Editorial workflow technical audit — 2026-10-08

## Content review pagination

`/admin/inhalte` previously fetched every Freshness record in batches of 500,
classified them in JavaScript, and sent the resulting ID list back to Postgres.
Both network traffic and server memory grew with the entire review inventory.

`editorial_content_review_page` now performs an approved-profile LEFT JOIN,
classification, filtering, exact count and stable `(display_name, id)` pagination
in one SQL statement/snapshot. The response contains at most 20 minimal profiles;
JSON projection happens after pagination. A missing Freshness record needs review.
The page uses the returned status, avoiding a second clock evaluation at render.

SQL preserves `freshnessStatus` precedence, UTC calendar-year addition, February
29 clamping, millisecond precision and strict `now > deadline` semantics.
Executable parity tests compare the same inputs against the actual JS function
in UTC, Berlin and New York sessions, before/at/after deadlines.

The additive migration `20261008193336_editorial_content_review_page.sql` creates
only a STABLE SECURITY INVOKER function with an explicit portal-admin check,
empty search path and authenticated EXECUTE. Existing table grants/RLS remain
unchanged. There are no writes or new public review-metadata permissions.

## Demonstrated additional defects and corrections

- Compact pending advertising requests signed private creative URLs despite not
  rendering previews. They now skip that Storage request. Normal inventory and
  detail views retain signed images.
- Advertising and verification decision actions omitted shared-layout
  revalidation. Successful decisions now invalidate the account task badge as
  well as their existing pages. Failed/unauthorized decisions do not invalidate.
  Regression tests failed before both corrections and passed afterwards.

## Other inspected paths

Dashboard/header share the request-local queue cache. The queue returns all
three counts from one snapshot and excludes archived/editorial ad requests.
The active company inventory uses its bounded SQL pager; advertising inventory
uses stable created_at/ID ordering with 20-row pages. Profile decisions lock the
pending profile and expected Freshness revision, preserve the separate review
capability and write private feedback atomically. The existing explicit admin
editor keeps approved profiles published and private notes internal. Content
review/withdrawal retain revision checks. Banner presentation remains separate
from booking; lineage reuse retains locking and duplicate guards. No approvals,
publications, bookings, taxonomy, media or lifecycle data were changed for QA.

## Query plans and verification limits

EXPLAIN ANALYZE of the actual query body under authenticated admin RLS on the
61-profile Cloud inventory: 2.09 ms execution, hash LEFT JOIN, top-N heapsort,
20 output rows, zero temporary blocks. The local 1000-profile fixture also stays
bounded and sorts in memory. These are observations, not a latency guarantee.
No additional index is justified by these plans. Exact totals necessarily scan
the matching inventory; deep OFFSET pages remain progressively more expensive.

Cloud verifies 58 review-needed plus 2 reviewed = 60 approved; access is denied
to non-admin authenticated users and anon. Migration-history SQL matches local
SQL. Before/after hashes match for profiles, campaigns, targets, taxonomy,
Freshness, gallery media, Storage objects, private notes/feedback and RLS.
Security Advisor findings are unchanged; pre-existing findings are not resolved
by this narrowly scoped migration.

The inline archive picker still loads the global campaign inventory before
application-side selection (subject to the Data API row cap). This is a remaining
scaling risk for a larger archive, not corrected by another banner architecture
in this block. The legacy `loadReviewOverview` batch helper has no active route
caller. Cross-request insertions can shift OFFSET pages; each individual count
and page is snapshot-consistent, not a frozen browsing session.

Desktop/mobile live interactions and real concurrent-save interleavings require
a working browser environment. Local role/transaction/UI tests and anonymous
HTTP checks must not be reported as that live evidence.
