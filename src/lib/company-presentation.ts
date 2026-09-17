import type { Listing } from "@/types/portal";
import type { SignedMedia } from "./company-media";

export type CompanyPresentation = {
  id: string;
  slug: string;
  display_name: string;
  tagline?: string | null;
  description?: string | null;
  business_areas?: string | null;
  postal_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  public_email?: string | null;
  website?: string | null;
  company_profile_categories: { category_id: string }[];
};
export function companyProfileListing(
  profile: CompanyPresentation,
  media: SignedMedia,
): Listing {
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.display_name,
    initials: profile.display_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toLocaleUpperCase("de"),
    tagline: profile.tagline ?? "",
    description: profile.description ?? "",
    businessAreas: profile.business_areas ?? "",
    categoryIds: profile.company_profile_categories.map(
      (category) => category.category_id,
    ),
    location: {
      postalCode: profile.postal_code ?? "",
      city: profile.city ?? "",
      region: profile.region ?? "",
      country: profile.country ?? "",
    },
    contact: {
      email: profile.public_email ?? "",
      phone: profile.phone ?? "",
      website: profile.website ?? "",
    },
    images: media.images,
    logo: media.logo,
    services: [],
    isDemo: false,
  };
}
