"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import {
  checkAdmin,
  approvePendingProfile,
  updatePublishedCategories,
  rejectPendingProfile,
  reviewTravelProfile,
  type ReviewResult,
} from "@/lib/admin-review";

async function finish(result: ReviewResult, profileId: string) {
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath("/", "layout");
    revalidatePath("/admin");
    revalidatePath(`/admin/firmen/${profileId}`);
    revalidatePath("/experten");
    revalidatePath("/unterkuenfte-a-z");
    revalidatePath("/firma");
    revalidatePath("/firma/profil");
    revalidatePath("/firma/profil/gestalten");
  }
  return { error: result.error, success: result.success };
}

export async function approveProfile(profileId: string, categoryIds: unknown) {
  const result = await approvePendingProfile(
    await createClient(),
    profileId,
    categoryIds,
  );
  return finish(result, profileId);
}

export async function rejectProfile(profileId: string) {
  const result = await rejectPendingProfile(await createClient(), profileId);
  return finish(result, profileId);
}

export async function saveCategories(profileId: string, categoryIds: unknown) {
  return finish(
    await updatePublishedCategories(
      await createClient(),
      profileId,
      categoryIds,
    ),
    profileId,
  );
}

export async function approveTravelProfile(profileId: string, expectedRevision: number, proposedKeys?: string[]) {
  return finish(await reviewTravelProfile(await createClient(), profileId, "approved", expectedRevision, "", proposedKeys), profileId);
}
export async function rejectTravelProfile(profileId: string, expectedRevision: number, feedback: string, proposedKeys?: string[]) {
  return finish(await reviewTravelProfile(await createClient(), profileId, "rejected", expectedRevision, feedback, proposedKeys), profileId);
}

export async function setProfilePublication(profileId: string, publish: boolean, expectedRevision: number, proposedKeys: string[] = []) {
  const client = await createClient();
  const access = await checkAdmin(client);
  requireAdminAccess(access);
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || typeof publish !== 'boolean' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || !Array.isArray(proposedKeys) || proposedKeys.length > 100 || proposedKeys.some(k => typeof k !== 'string')) return { error: 'Bitte laden Sie den aktuellen Profilstand neu.' };
  const result = await client.rpc('set_travel_profile_publication', { p_profile_id: profileId, p_publish: publish, p_expected_revision: expectedRevision, p_expected_proposals: proposedKeys });
  return finish(result.error || result.data !== (publish ? 'published' : 'withdrawn') ? { access, error: 'Die Veröffentlichung konnte nicht geändert werden. Bitte speichern Sie die Zuordnungen und laden Sie den aktuellen Profilstand neu.' } : { access, success: publish ? 'Das Profil wurde veröffentlicht.' : 'Die Veröffentlichung wurde zurückgenommen. Inhalte und Zuordnungen bleiben erhalten.' }, profileId);
}
