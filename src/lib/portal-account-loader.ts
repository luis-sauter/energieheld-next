import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin } from "./admin-review";

export async function loadPortalAccount(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { access: "unauthenticated" as const, hasCompany: false, user: null };
  const [access, company] = await Promise.all([
    checkAdmin(client),
    client.from("companies").select("id").eq("owner_user_id", user.id).maybeSingle(),
  ]);
  return { access, hasCompany: !company.error && Boolean(company.data), user };
}

