"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requestOwnVerification } from "@/lib/company-quality-request";

export async function requestQualityVerification(): Promise<{
  error?: string;
  success?: string;
}> {
  const result = await requestOwnVerification(await createClient());
  if (result.unauthenticated) redirect("/login");
  if (result.success) {
    revalidatePath("/firma");
    revalidatePath("/admin", "layout");
  }
  return { error: result.error, success: result.success };
}
