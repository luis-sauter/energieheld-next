// Render only from server-verified admin provenance; publication status is independent.
export function ProfileImportBadge({ imported }: { imported?: boolean }) {
  return imported ? <span className="profile-import-badge">Neu importiert</span> : null;
}
