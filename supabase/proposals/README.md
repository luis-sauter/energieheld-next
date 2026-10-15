# Unapplied database proposals

Files here are reviewed locally and are deliberately outside `supabase/migrations`.
They must not be included in a database push or treated as an approved rollout.

`20261015225242_basic_acquisition_foundation.sql` prepares private acquisition
records and a separate public contact projection. It changes no existing rows,
policies or functions. The application does not query the new tables yet.

The proposal is **only a foundation**, not a complete public search/import release.
A later rollout needs separate approval, a current schema/API-exposure review,
source-use clearance, the search/count/filter integration, transactional identity
locking and a controlled publication step. No acquisition UI is provided.

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
