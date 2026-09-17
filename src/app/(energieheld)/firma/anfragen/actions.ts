"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateLeadStatus, type LeadState } from "@/lib/company-leads";
export async function changeLeadStatus(
  _previous: LeadState,
  form: FormData,
): Promise<LeadState> {
  let result;
  try {
    result = await updateLeadStatus(await createClient(), form);
  } catch {
    return { error: "Der Status konnte gerade nicht gespeichert werden." };
  }
  if (result.unauthenticated) redirect("/login");
  if (result.success) revalidatePath("/firma/anfragen");
  return result;
}
