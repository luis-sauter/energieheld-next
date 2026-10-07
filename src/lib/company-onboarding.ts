export type OnboardingProfile = {
  status: string; display_name?: string | null; description?: string | null;
  phone?: string | null; public_email?: string | null; website?: string | null;
  postal_code?: string | null; city?: string | null; logo_path?: string | null;
  video_path?: string | null; company_profile_images?: unknown[] | null;
};

export function companyPreparation(profile: OnboardingProfile) {
  const basics = Boolean(profile.display_name?.trim() && profile.description?.trim() &&
    (profile.phone?.trim() || profile.public_email?.trim() || profile.website?.trim()) &&
    profile.postal_code?.trim() && profile.city?.trim());
  const media = Boolean(profile.logo_path || profile.video_path || profile.company_profile_images?.length);
  const submitted = ["pending", "approved"].includes(profile.status);
  const next = !basics ? 0 : !media ? 1 : 2;
  return { basics, media, submitted, next, completed: Number(basics) + Number(media) + Number(submitted) };
}
