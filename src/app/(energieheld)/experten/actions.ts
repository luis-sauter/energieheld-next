"use server";
import { createPublicClient } from "@/lib/supabase/public";
import { createLead, type LeadState } from "@/lib/company-leads";
// Public submission is intentional. The RPC permits only approved database profiles.
export async function sendInquiry(
  profileId: string,
  _previous: LeadState,
  form: FormData,
): Promise<LeadState> {
  try {
    return await createLead(createPublicClient(), profileId, form);
  } catch {
    return {
      error:
        "Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.",
    };
  }
}
