# Host proposals and editorial travel review

## Data and provenance

`company_profile_travel_proposals` holds private, normalized host input. It starts empty; historical confirmed classifications are neither copied into proposals nor relabeled as host input. Existing `company_profile_travel_terms` remains the sole classification source for public filters. Owners may propose changes, including for approved profiles, but cannot write confirmed terms.

`save_own_travel_profile` keeps its existing signature, field allowlist, ownership and status checks. Its selected terms now persist as proposals. Logo, gallery, video, maps and editorial-note pipelines remain unchanged. Approved profile text/contact editing retains its existing publication behavior.

## Editorial decisions

The review page reads terms, proposals, confirmed keys and content revision with one `admin_profile_travel_review` snapshot. Checkbox changes and filter preview are local until the explicit save succeeds. Preview links reuse `thema`, `zielgruppe` and `unterkunftstyp`; internal features have no public filter link.

`save_profile_travel_assignments` authorizes the actual portal admin, locks the profile and Freshness row, validates term keys, then checks the expected revision, confirmed keys and proposals. The complete selection is stored atomically. Existing classification triggers maintain the content revision. A stale snapshot fails without partial changes; saving never publishes a profile.

The current review UI uses `review_travel_profile_with_proposals`, retaining the existing revision-checked decision/feedback implementation and adding a proposal snapshot check. Pending is required. Unsaved selection prevents both publication and feedback in this UI. Rejection requires a concrete private message of at most 4,000 characters. Historical feedback is displayed as an active request only while the profile is rejected. Owner resubmission keeps the same profile, media and proposals.

## Explicit development permission policy

Every existing or future row in `portal_admins` authorizes travel first-publication and feedback. `can_review_travel_profiles()` is the central SQL policy; application actions verify actual admin membership. No admin rows are updated. Separate `can_review_profiles` checks for Freshness and legacy Energyheld approval/category integrity remain intact. This travel-specific permission rule can be revised later without reclassifying historical profiles.

## Security and deployment

Migration: `20261008212320_host_travel_proposals_review.sql`, registered on the confirmed development Cloud with exactly matching SQL. No profile, classification, company, admin, category, media, Storage, booking or feedback rows were modified during migration or read-only Cloud QA.

Proposals use owner-own INSERT/DELETE/SELECT and admin SELECT RLS; anon has no read grant. Only the two former owner-write policies on confirmed classifications were removed. All other existing policies and profile triggers remained identical. New public RPCs are SECURITY INVOKER with no anon EXECUTE. Authorized locking operations run through narrow private functions; authenticated has no private-schema USAGE. No Storage policies or triggers were changed. No additional Security Advisor finding appeared.

The new application requires this migration before deployment: missing proposal/schema or review RPCs produce visible errors and disable editorial decisions rather than silently confirming assignments.

## Verification and remaining QA

Executable role/migration tests cover owner/foreign/anon, existing and future admins, approved-history preservation, explicit atomic saves, invalid terms, stale revisions/proposals/assignments, pending-only decisions, private feedback/resubmission and independent Freshness/Energyheld constraints. UI handler and server-action tests cover immediate local preview, error versus success, saved revision propagation, submission/reload and duplicate submission.

Read-only Cloud checks exercised all three actual admins and a real non-admin owner, denied owner review/save and anon private reads, and verified public invoker wrappers. Hashes of all twelve tracked existing data sets matched before/after; status counts stayed 60 approved, one pending and one rejected. No production status was changed for QA.

Real browser QA remains a separate requirement. If the browser runtime fails before opening a page, automated component tests and HTTP checks do not establish desktop/mobile visual behavior or live save/reload correctness. Do not treat that limitation as missing QA credentials or manual acceptance.
