// Presentation, not privacy: profile RLS and linked advertising remain unchanged.
export function isPubliclyListed(row: { company_profile_public_visibility?: {is_listed:boolean} | {is_listed:boolean}[] | null }) {
  const visibility = row.company_profile_public_visibility;
  return Array.isArray(visibility) ? !visibility.some(v => v.is_listed === false) : visibility?.is_listed !== false;
}
