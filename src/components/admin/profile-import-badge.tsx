// Parents supply verified private admin provenance or the safe public projection.
// Publication status never determines this presentational marker.
export function ProfileImportBadge({ imported }: { imported?: boolean }) {
  return imported ? <span className="profile-import-badge">Neu importiert</span> : null;
}
