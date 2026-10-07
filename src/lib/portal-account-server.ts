import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { loadPortalAccount } from "./portal-account-loader";

// Request-local reuse across layout and B2B pages; never a shared user cache.
export const getPortalAccount = cache(async () => {
  try { return await loadPortalAccount(await createClient()); }
  catch { return { access: "unauthenticated" as const, hasCompany: false, user: null }; }
});
