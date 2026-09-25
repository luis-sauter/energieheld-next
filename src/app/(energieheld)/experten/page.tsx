export const dynamic = "force-dynamic";
import { DirectoryPage } from "@/components/portal/directory-page";
import { checkAdmin } from "@/lib/admin-review";
import { createClient } from "@/lib/supabase/server";
import { saveCompanyDirectoryOrder } from "./order-actions";
export const metadata = { title: "Experten A–Z" };
export default async function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let canReorder = false;
  if (!["q", "kategorie", "ort", "sort"].some((key) => params[key] !== undefined)) {
    try {
      canReorder = (await checkAdmin(await createClient())) === "admin";
    } catch {
      // Public reading must remain available without an auth session.
    }
  }
  return (
    <DirectoryPage
      searchParams={Promise.resolve(params)}
      canReorder={canReorder}
      saveOrder={canReorder ? saveCompanyDirectoryOrder : undefined}
    />
  );
}
