import "server-only";
import { companyProfileListing } from "./company-presentation";
import { signCompanyMedia, type MediaRow } from "./company-media";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing, CompanyVerification } from "@/types/portal";
import { createPublicClient } from "./supabase/public";
import { sortByDirectoryOrder, type DirectoryOrderRow } from "./company-directory-order";

export const PUBLIC_COMPANIES_ERROR =
  "Die Unternehmensprofile konnten gerade nicht geladen werden.";

const publicFields =
  "id,status,slug,display_name,tagline,description,phone,public_email,website,postal_code,city,region,country,logo_path,company_profile_images(id,storage_path,alt_text,sort_order),business_areas,company_profile_categories(category_id),company_quality_reviews(status,verified_at,public_note)";

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
  company_quality_reviews?: CompanyVerification | CompanyVerification[] | null;
};
async function toListing(
  client: SupabaseClient,
  row: PublicProfile,
): Promise<Listing> {
  const media = await signCompanyMedia(client, row);
  return companyProfileListing(row, media);
}

type Result<T> = { data: T; error: null } | { data: null; error: string };

export async function loadPublicCompanies(): Promise<Result<Listing[]>> {
  try {
    const client = createPublicClient();
    const profiles: PublicProfile[] = [];
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
      profiles.push(...rows.filter((row) => row.status === "approved"));
      if (rows.length < pageSize) break;
    }
    const orderRows: DirectoryOrderRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("company_directory_order")
        .select("profile_id,sort_order")
        .order("profile_id")
        .range(offset, offset + pageSize - 1);
      // The public directory remains available until the repository migration is deployed.
      if (error?.code === "42P01" || error?.code === "PGRST205") break;
      if (error) throw error;
      const rows = (data ?? []) as DirectoryOrderRow[];
      orderRows.push(...rows);
      if (rows.length < pageSize) break;
    }
    return {
      data: await Promise.all(
        sortByDirectoryOrder(profiles, orderRows).map((row) => toListing(client, row)),
      ),
      error: null,
    };
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
