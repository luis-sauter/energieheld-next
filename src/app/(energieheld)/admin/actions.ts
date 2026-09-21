"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import {
  approvePendingProfile,
  updatePublishedCategories,
  rejectPendingProfile,
  type ReviewResult,
} from "@/lib/admin-review";

async function finish(result: ReviewResult, profileId: string) {
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath("/admin");
    revalidatePath(`/admin/firmen/${profileId}`);
    revalidatePath("/experten");
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
