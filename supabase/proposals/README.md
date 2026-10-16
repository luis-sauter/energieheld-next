# Database proposals

## Applied current foundation

`20261016131421_basic_acquisition_master_foundation.sql` was explicitly approved
and applied once to the confirmed Supabase project on 2026-10-16. Its unchanged
SQL now lives in `supabase/migrations`; the SQL file's original draft-only header
is preserved as part of the approved immutable bytes, not the current status.
SHA256: `77c22581cfcce060f5fe990a745ef1f5b558ac5ff01b52b6f9f12bba0a623cb0`.

The connector-created history version was normalized to `20261016131421` under
explicit approval, without executing SQL again. Eight new tables are empty,
RLS/FORCE and API privilege denials verified. The seven-table private foundation
and closed contact projection activate no imports, publications, API wrappers,
Admin UI or worker credentials. The restricted category role remains NOLOGIN
without application/worker membership; the trusted migration creator has only
its expected administrative membership (INHERIT/SET false).

Automatic evidence, durable manual category decisions and effective themes are
separate. Private Admin helpers require the existing verified Admin identity,
expected revision and atomic audit. Source rights, evidence, municipality history
and price calculations are checked. No existing profile, media, campaign or
publication data were changed. Local tests and native PostgreSQL checks passed;
post-application metadata/API checks confirmed the closed Cloud state. Full
search/Admin integration and publication remain separate later phases.

The earlier proposal below is superseded and must never be applied. Never run a
general database push to apply unrelated files.

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
