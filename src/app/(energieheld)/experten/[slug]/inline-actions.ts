"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { checkInlineProfileTarget } from "@/lib/inline-admin-profile";
import { updateAdminCompanyProfile } from "@/lib/admin-profile";
import { changeAdminCompanyMedia } from "@/lib/admin-company-media";
import type { ProfileFormState } from "@/lib/company-profile";
import type { MediaState } from "@/lib/company-media";

export async function saveInlineProfile(
  profileId: string,
  slug: string,
  form: FormData,
): Promise<ProfileFormState> {
  let target, result;
  try {
    const client = await createClient();
    target = await checkInlineProfileTarget(client, profileId, slug);
    if (target.access === "admin" && !target.error)
      result = await updateAdminCompanyProfile(client, profileId, form);
  } catch {
    return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(target.access);
  if (target.error) return { error: target.error };
  requireAdminAccess(result!.access);
  if (result!.success) {
    revalidatePath(`/experten/${slug}`);
    revalidatePath(`/unterkuenfte/${slug}`);
  }
  return { error: result!.error, success: result!.success };
}

export async function saveInlineMedia(
  profileId: string,
  slug: string,
  form: FormData,
): Promise<MediaState> {
  let target, result;
  try {
    const client = await createClient();
    target = await checkInlineProfileTarget(client, profileId, slug);
    if (target.access === "admin" && !target.error)
      result = await changeAdminCompanyMedia(client, profileId, form);
  } catch {
    return { error: "Die Medien konnten gerade nicht geändert werden. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(target.access);
  if (target.error) return { error: target.error };
  requireAdminAccess(result!.access);
  if (result!.success) {
    revalidatePath(`/experten/${slug}`);
    revalidatePath(`/unterkuenfte/${slug}`);
  }
  return { uploadPath: result!.uploadPath, error: result!.error, success: result!.success };
}

export async function reviewInlineProfile(profileId: string, slug: string, revision: number): Promise<{ error?: string; success?: string }> {
  try {
    const client = await createClient();
    const target = await checkInlineProfileTarget(client, profileId, slug);
    requireAdminAccess(target.access);
    if (target.error) return { error: target.error };
    if (!Number.isSafeInteger(revision) || revision < 1) return { error: "Der Prüfstand ist ungültig. Bitte laden Sie das Profil neu." };
    const { error } = await client.rpc("review_profile_content", { p_profile_id: profileId, p_expected_revision: revision });
    if (error) return { error: error.code === "PT409"
      ? "Das Profil wurde zwischenzeitlich geändert. Bitte prüfen Sie den aktuellen Stand erneut."
      : "Die Prüfung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };
    revalidatePath(`/experten/${slug}`);
    revalidatePath(`/unterkuenfte/${slug}`);
    return { success: "Der aktuelle Profilinhalt wurde als geprüft markiert." };
  } catch { return { error: "Die Prüfung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." }; }
}

export async function withdrawInlineProfileReview(profileId: string, slug: string, revision: number, reviewedAt: string): Promise<{ error?: string; success?: string }> {
  try {
    const client = await createClient();
    const target = await checkInlineProfileTarget(client, profileId, slug);
    requireAdminAccess(target.access);
    if (target.error) return { error: target.error };
    if (!Number.isSafeInteger(revision) || revision < 1 || typeof reviewedAt !== "string" || !Number.isFinite(Date.parse(reviewedAt)))
      return { error: "Der Prüfstand ist ungültig. Bitte laden Sie das Profil neu." };
    const { error } = await client.rpc("invalidate_profile_review", {
      p_profile_id: profileId, p_expected_revision: revision, p_expected_reviewed_at: reviewedAt,
    });
    if (error) return { error: error.code === "PT409"
      ? "Profil oder Prüfung wurden zwischenzeitlich geändert. Bitte prüfen Sie den aktuellen Stand erneut."
      : "Die Prüfung konnte nicht zurückgezogen werden. Bitte versuchen Sie es erneut." };
    revalidatePath(`/experten/${slug}`);
    revalidatePath(`/unterkuenfte/${slug}`);
    revalidatePath("/unterkuenfte-a-z");
    return { success: "Die Prüfung wurde zurückgezogen." };
  } catch { return { error: "Die Prüfung konnte nicht zurückgezogen werden. Bitte versuchen Sie es erneut." }; }
}
