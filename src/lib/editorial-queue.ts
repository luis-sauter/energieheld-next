import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin } from "./admin-review";
export type EditorialCounts = { profiles: number; advertising: number; verifications: number; total: number };
export type EditorialTask = { id: string; kind: "profile" | "advertising" | "verification"; name: string; submitted_at: string | null; status: string; href: string };
export type EditorialQueue = { counts?: EditorialCounts; tasks: EditorialTask[]; error?: string };
export async function loadEditorialQueue(client: SupabaseClient): Promise<EditorialQueue> {
  if (await checkAdmin(client) !== "admin") return { tasks: [], error: "Keine Berechtigung für Redaktionsaufgaben." };
  try {
    const { data, error } = await client.rpc("editorial_work_queue");
    if (error || !data?.counts || !Array.isArray(data.tasks) || !(["profiles","advertising","verifications","total"] as const).every(key => Number.isSafeInteger(data.counts[key]) && data.counts[key] >= 0) || data.counts.total !== data.counts.profiles + data.counts.advertising + data.counts.verifications) throw Error();
    return { counts: data.counts, tasks: data.tasks };
  } catch { return { tasks: [], error: "Die offenen Aufgaben konnten nicht geladen werden. Bitte laden Sie die Seite erneut." }; }
}
export async function loadReviewFeedback(client: SupabaseClient, profileId: string) {
  const { data, error } = await client.from("company_profile_review_feedback").select("message,reviewed_at").eq("profile_id", profileId).maybeSingle();
  return error ? { error: "Die Rückmeldung der Redaktion konnte nicht geladen werden." } : { message: data?.message as string | undefined };
}
