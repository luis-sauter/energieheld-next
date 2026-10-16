# Unapplied database proposals

## Current foundation redesign

`20261016131421_basic_acquisition_master_foundation.sql` is the new, local-only
seven-table foundation draft. It is NOT approved for Cloud application. The
previous `20261015225242` proposal below is superseded and retained only as a
historical regression fixture: **do not apply it**.

The new draft separates street, house number, postal code and city for BOTH
lodging and company addresses. Municipality is a separate reference. Unknown
candidate fields remain NULL; a same-accommodation primary observation must be
inserted in the same transaction. Source versions and observation history are
immutable. No worker roles, logins, API RPCs or active publication path are
created. The public contact table is empty, deny-all and cannot be listed in
this foundation. A later reviewed publication implementation is required.

Phase A local constraint/ACL tests are not proof of a deployed database, real
multi-session concurrency, source rights or search performance. Do not promote
this draft until its remaining real-PostgreSQL and current-Cloud-preflight gates
are documented. Existing public application routes are unchanged.

## Historical proposal (superseded)

Files here are reviewed locally and are deliberately outside `supabase/migrations`.
They must not be included in a database push or treated as an approved rollout.

`20261015225242_basic_acquisition_foundation.sql` prepares private acquisition
records and a separate public contact projection. It changes no existing rows,
policies or functions. The application does not query the new tables yet.

The proposal is **only a foundation**, not a complete public search/import release.
A later rollout needs separate approval, a current schema/API-exposure review,
source-use clearance, the search/count/filter integration, transactional identity
locking and a controlled publication step. No acquisition UI is provided.

Phase 2A preflight refinements (still unapplied): contact people/roles require a
same-identity source FK; partial private addresses accept NULL but no arbitrary
fields; comparison prices require a known basis and verified extras. Existing
profile deletion uses SET NULL, preserving the private identity and keeping its
withdrawn Basic draft hidden. Publication locks the identity row against upgrades
and withdrawal. Short transaction-local lock/statement budgets fail on contention.
Final ACL assertions abort the transaction if unexpected privileges survive.

Application requires explicit approval of this exact file and its SHA256. Use a
single targeted migration and history entry, never a general database push. Stop
on pre-existing objects; CREATE is intentionally one-time, not overwrite/upsert.
The schema is empty; no seed/import/publication is included. Its two trigger
functions require the reviewed BYPASSRLS migration owner. They are private,
non-callable by API roles and use an empty search_path. A later writer role and
publication/search workflow require a separate review.

Before commit, any failure rolls the complete transaction back. After commit,
withdraw public column grants first if containment is needed. A full withdrawal
must verify all nine tables are empty and remove only this proposal's objects in
dependency order without CASCADE; stop on any data or unexpected dependency.
Never use a reset or remove existing profiles/taxonomy/other migrations. Rollback
and history reconciliation are separate controlled actions, not automatic retries.

Local checks:

```text
node --test tests/basic-accommodation-pilot.test.mjs tests/basic-accommodation-foundation-db.test.mjs
node scripts/prepare-basic-accommodations.mjs --input PRIVATE_INPUT.json --existing PRIVATE_INDEX.json --out PRIVATE_DIRECTORY
```

The preparation command has no network/database/apply mode, requires a complete
bounded identity/taxonomy snapshot and refuses research output inside this repo.
It always reports `canPublish: false`. Replays can use `--state` with the previous
`internal-stage.json`; changed records require review instead of overwriting data.
Only synthetic records belong in committed tests. Real research, people, contacts
and source notes remain outside the application and its frontend bundles.
