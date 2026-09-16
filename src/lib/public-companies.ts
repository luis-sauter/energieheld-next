import "server-only";
import { signCompanyMedia, type MediaRow } from "./company-media";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "@/types/portal";
import { createPublicClient } from "./supabase/public";

export const PUBLIC_COMPANIES_ERROR =
  "Die Unternehmensprofile konnten gerade nicht geladen werden.";

const publicFields =
  "id,status,slug,display_name,tagline,description,phone,public_email,website,postal_code,city,region,country,logo_path,company_profile_images(id,storage_path,alt_text,sort_order),business_areas,company_profile_categories(category_id)";

type PublicProfile = {
  id: string;
  status: string;
  slug: string;
  display_name: string;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  public_email: string | null;
  website: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  logo_path: string | null;
  company_profile_images: MediaRow[];
  business_areas: string | null;
  company_profile_categories: { category_id: string }[];
};
async function toListing(
  client: SupabaseClient,
  row: PublicProfile,
): Promise<Listing> {
  const media = await signCompanyMedia(client, row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    initials: row.display_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toLocaleUpperCase("de"),
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    categoryIds: row.company_profile_categories.map(
      (category) => category.category_id,
    ),
    location: {
      postalCode: row.postal_code ?? "",
      city: row.city ?? "",
      region: row.region ?? "",
      country: row.country ?? "",
    },
    businessAreas: row.business_areas ?? "",
    services: [],
    images: media.images,
    logo: media.logo,
    contact: {
      email: row.public_email ?? "",
      phone: row.phone ?? "",
      website: row.website ?? "",
    },
    isDemo: false,
  };
}

type Result<T> = { data: T; error: null } | { data: null; error: string };

export async function loadPublicCompanies(): Promise<Result<Listing[]>> {
  try {
    const client = createPublicClient();
    const profiles: Listing[] = [];
    // Avoid silently truncating the directory at the API's default row limit.
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("company_profiles")
        .select(publicFields)
        .eq("status", "approved")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data as PublicProfile[];
      profiles.push(
        ...(await Promise.all(
          rows
            .filter((row) => row.status === "approved")
            .map((row) => toListing(client, row)),
        )),
      );
      if (rows.length < pageSize) break;
    }
    return { data: profiles, error: null };
  } catch {
    console.error("Public company directory query failed.");
    return { data: null, error: PUBLIC_COMPANIES_ERROR };
  }
}

export async function loadPublicCompanyBySlug(
  slug: string,
): Promise<Result<Listing | null>> {
  try {
    const client = createPublicClient();
    const { data, error } = await client
      .from("company_profiles")
      .select(publicFields)
      .eq("status", "approved")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return {
      data:
        data?.status === "approved"
          ? await toListing(client, data as PublicProfile)
          : null,
      error: null,
    };
  } catch {
    console.error("Public company profile query failed.");
    return { data: null, error: PUBLIC_COMPANIES_ERROR };
  }
}
