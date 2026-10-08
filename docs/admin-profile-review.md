# Admin profile review

The review page keeps company details, private company notes, media, travel assignments and optional quality verification ahead of the final approval decision. All editorial links use the existing admin preview with `?bearbeiten=1`; approved profiles remain in that verified admin editor. Notes are never added to public content. Return navigation protects unsaved form changes.

## Travel approval and legacy compatibility

`20261008121238_travel_profile_review.sql` adds a protected `approval_context` to company profiles. Existing profiles retain `energyheld`; no statuses or category assignments are rewritten. Only the explicit pending-to-approved travel review changes the context to `reiseportal`.

The public `review_travel_company_profile` RPC uses SECURITY INVOKER and calls a private, permission-checked implementation. Both the server action and database require a current portal admin with `can_review_profiles`. Owners and ordinary editors cannot set approval context or approve profiles. No new roles, RLS policies or private-schema access are granted.

The historical review/category RPCs remain available. Their energy-category requirements and deferred integrity checks continue to apply to the legacy context. Travel approval does not invent energy categories or travel assignments, and does not remove existing categories. Merely opening the editor does not approve or publish a profile.

## Verification

Real-role database tests cover travel approval, rejection, denied access, deferred legacy category integrity and unchanged existing records. UI tests cover review ordering, editor entry, private notes, aligned taxonomy controls and existing save/cancel behavior. Live QA must not approve a real profile without explicit permission.

## Editorial dashboard and owner feedback

`20261008150102_editorial_dashboard_workflow.sql` adds bounded admin-only queue and company-search RPCs. The dashboard and header share a request-local snapshot; only pending profiles, non-editorial/non-archived pending advertising requests and pending verification requests count as open tasks. Company management uses server-side search and stable 20-row pagination.

Private review feedback is stored separately from company notes. Owners can read only their own feedback; admins can read it. Direct API writes and anonymous reads are denied. The new decision RPC locks the profile and its content revision, requires a rejection reason, and writes feedback and the decision atomically. A changed revision requires reloading the review. Historical approval RPCs remain compatible.

Public submission no longer requires optional business areas. Editorial UI uses only “Prüfung erforderlich” and “Bereits geprüft”; internal Freshness states, revisions and publication permissions are preserved.
