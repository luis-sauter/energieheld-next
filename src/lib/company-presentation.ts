import type { Listing, CompanyVerification } from "@/types/portal";
import type { SignedMedia } from "./company-media";
import { readVerification } from "./company-verification";

export type CompanyPresentation = {
  id: string;
  slug: string;
  display_name: string;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  tagline?: string | null;
  description?: string | null;
  business_areas?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  public_email?: string | null;
  website?: string | null;
  company_profile_categories: { category_id: string }[];
  company_quality_reviews?: CompanyVerification | CompanyVerification[] | null;
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
      street: profile.street ?? "",
      postalCode: profile.postal_code ?? "",
      city: profile.city ?? "",
      region: profile.region ?? "",
      country: profile.country ?? "",
    },
    contact: {
      person: [profile.contact_first_name?.trim(), profile.contact_last_name?.trim()].filter(Boolean).join(" ") || undefined,
      personImage: media.contactImage,
      email: profile.public_email ?? "",
      phone: profile.phone ?? "",
      website: profile.website ?? "",
    },
    ...(media.video ? { video: { ...media.video, poster: media.images[0]?.src } } : {}),
    images: media.images,
    logo: media.logo,
    services: [],
    isDemo: false,
    verification: readVerification(profile.company_quality_reviews),
  };
}
