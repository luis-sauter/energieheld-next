/** Existing feature dimension; independent of all four seasonal theme keys. */
export const SPECIAL_TOPIC_TERM = 'feature:sonderthema';

// Retain historical assignments in the full save payload, but do not offer new ones.
export function isRetiredTravelTerm(key: string) {
  return key === 'theme:tauchurlaub';
}
