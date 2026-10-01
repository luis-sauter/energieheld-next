import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin } from "./admin-review";
import { inlineAdContext } from "./inline-ad-context";
import { isSidebarOrder } from "./sidebar-order";

export async function reorderInlineBannerContents(client: SupabaseClient, path: string, sources: unknown, expected: unknown) {
  const context = inlineAdContext(path);
  if (!context || await checkAdmin(client) !== "admin") return { error: "Sie sind für diese Änderung nicht berechtigt." };
  if (!isSidebarOrder(sources) || !Array.isArray(expected) || expected.length !== 12 ||
    !expected.every((item) => typeof item === "string" && item.length <= 64))
    return { error: "Die Banner-Reihenfolge ist ungültig. Bitte laden Sie die Seite neu." };
  const { error } = await client.rpc("reorder_inline_ad_contents", { p_target_type: context.target_type,
    p_target_key: context.target_key, p_sources: sources, p_expected: expected });
  return error ? { error: "Die Bannerinhalte konnten nicht verschoben werden. Belegte Firmenplätze und gemeinsam verwendete Banner bleiben geschützt. Bitte laden Sie die Seite neu." }
    : { success: "Die Bannerinhalte wurden verschoben. Die Plätze A–L bleiben unverändert." };
}
