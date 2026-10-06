import { DirectoryPage } from "@/components/portal/directory-page";
import { checkAdmin } from "@/lib/admin-review";
import { createClient } from "@/lib/supabase/server";
import { saveCompanyDirectoryOrder, saveSidebarOrder } from "../experten/order-actions";
import { directoryMetadata, type SearchParameters } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParameters> }) {
  return directoryMetadata(await searchParams);
}

export default async function AccommodationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let adminClient;
  try {
    const client = await createClient();
    if (await checkAdmin(client) === "admin") adminClient = client;
  } catch {
    // Public reading remains available without an admin session.
  }
  const canReorder = Boolean(adminClient) && !["q", "ort", "sort", "ziel", "thema", "zielgruppe", "unterkunftstyp"].some((key) => params[key] !== undefined);
  return <DirectoryPage mode="travel" searchParams={Promise.resolve(params)}
    adminClient={adminClient} canReorder={canReorder}
    saveOrder={canReorder ? saveCompanyDirectoryOrder : undefined}
    saveSidebarOrder={canReorder ? saveSidebarOrder : undefined} />;
}
