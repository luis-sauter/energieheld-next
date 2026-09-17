"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import {
  profileFields,
  updateOwnCompanyProfile,
  type ProfileFormState,
} from "@/lib/company-profile";
export async function submitFirstPublication(): Promise<ProfileFormState> {
  const client = await createClient();
  const dashboard = await loadCompanyDashboard(client);
  if (!dashboard.authenticated) redirect("/login");
  if (dashboard.error || !dashboard.profile)
    return {
      error: dashboard.error ?? "Ihr Profil konnte nicht geladen werden.",
    };
  if (dashboard.profile.status === "approved")
    return { error: "Ihr Profil ist bereits freigeschaltet." };
  if (dashboard.profile.status === "pending")
    return { success: "Die Erstfreischaltung wurde bereits angefragt." };
  const form = new FormData();
  for (const field of profileFields)
    form.set(field, dashboard.profile[field] ?? "");
  form.set("intent", "submit");
  let result: ProfileFormState;
  try {
    result = await updateOwnCompanyProfile(client, form);
  } catch {
    return { error: "Die Anfrage konnte gerade nicht gesendet werden." };
  }
  if (result.unauthenticated) redirect("/login");
  if (result.success) {
    revalidatePath("/firma");
    revalidatePath("/firma/profil/gestalten");
    revalidatePath("/admin");
  }
  return result;
}
