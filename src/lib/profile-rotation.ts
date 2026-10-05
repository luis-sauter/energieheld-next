export const profileGroupSize = 6;
export const profileRotationLimit = 30;
export const profileRotationDelay = 6_000;

// A UTC day is shared by server-rendered markup and hydration. Keep the
// editorial order as the ring, and rotate separately within package tiers.
export function selectRotatingProfiles<T extends { id: string; directoryPackage?: string }>(
  profiles: readonly T[], rubric: string, day = Math.floor(Date.now() / 86_400_000),
): T[] {
  const unique = [...new Map(profiles.map((profile) => [profile.id, profile])).values()];
  const seed = [...rubric].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
  function rotate(items: T[]) {
    if (!items.length) return items;
    const offset = (seed + day) % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
  }
  return [
    ...rotate(unique.filter((profile) => profile.directoryPackage === "premium")),
    ...rotate(unique.filter((profile) => profile.directoryPackage !== "premium")),
  ].slice(0, profileRotationLimit);
}

export function profileGroups<T>(profiles: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(profiles.length / profileGroupSize) }, (_, index) =>
    profiles.slice(index * profileGroupSize, (index + 1) * profileGroupSize));
}

export function nextProfileGroup(current: number, direction: number, count: number) {
  return count ? (current + direction + count) % count : 0;
}

export function rotationCanPlay(groupCount: number, ...paused: boolean[]) {
  return groupCount > 1 && !paused.some(Boolean);
}

export function scheduleProfileAdvance(advance: () => void, delay = profileRotationDelay) {
  const timer = setTimeout(advance, delay);
  return () => clearTimeout(timer);
}
