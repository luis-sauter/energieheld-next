export const demoProfileId = "31ae7d1e-26a7-4161-8d14-f5ee4735f5d4";
export const demoSourceSlug = "energieheld-demo-gmbh-c3351d59";
export const demoPublicSlug = "demo-gmbh";

export function isLiveDemoProfile(profile: { id: string; slug: string }) {
  return profile.id === demoProfileId && profile.slug === demoPublicSlug;
}

export function publicSlugForStoredProfile(profile: { id: string; slug: string }) {
  return profile.id === demoProfileId && profile.slug === demoSourceSlug
    ? demoPublicSlug : profile.slug;
}

export function storedSlugForInlineTarget(profileId: string, publicSlug: string) {
  if (publicSlug !== demoPublicSlug) return publicSlug;
  return profileId === demoProfileId ? demoSourceSlug : null;
}
