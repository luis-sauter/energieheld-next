import { DirectoryPage } from "@/components/portal/directory-page";
import { checkAdmin } from "@/lib/admin-review";
import { createClient } from "@/lib/supabase/server";
import { saveCompanyDirectoryOrder, saveSidebarOrder } from "../experten/order-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unterkünfte A–Z" };

export default async function AccommodationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let canReorder = false;
  if (!["q", "ort", "sort"].some((key) => params[key] !== undefined)) {
    try {
      canReorder = (await checkAdmin(await createClient())) === "admin";
    } catch {
      // Public reading remains available without an admin session.
    }
  }
  return <DirectoryPage mode="travel" searchParams={Promise.resolve(params)}
    canReorder={canReorder}
    saveOrder={canReorder ? saveCompanyDirectoryOrder : undefined}
    saveSidebarOrder={canReorder ? saveSidebarOrder : undefined} />;
}
