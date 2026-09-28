import type { SupabaseClient } from "@supabase/supabase-js";
import { ABOUT_SECTION, BUSINESS_SECTION, editorialOrder, type HeadingSlot, type ProfileContentBlock } from "./profile-content";
import { normalizeTextBlockLayout, validOffset, validSpacing, validTextAlignment, validWidth } from "./content-block-layout";
import { isProfileId } from "./admin-review";

type Result = { error?: string; success?: string };
const failed = "Der redaktionelle Abschnitt konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";

export function sectionSlot(key: unknown): HeadingSlot | null {
  return key === ABOUT_SECTION ? "about_heading" : key === BUSINESS_SECTION ? "business_areas_heading" : null;
}

async function ensureSection(client: SupabaseClient, profileId: string, slot: HeadingSlot) {
  const existing = await client.from("profile_content_blocks").select("id,content")
    .eq("profile_id", profileId).eq("slot", slot).maybeSingle();
  if (existing.error) return null;
  if (existing.data) return existing.data as { id: string; content: ProfileContentBlock["content"] };
  let heading = "Tätigkeitsbereiche";
  if (slot === "about_heading") {
    const profile = await client.from("company_profiles").select("display_name").eq("id", profileId).maybeSingle();
    if (profile.error || !profile.data?.display_name) return null;
    heading = `Über ${profile.data.display_name}`.slice(0, 200);
  }
  const inserted = await client.from("profile_content_blocks")
    .insert({ profile_id: profileId, type: "heading", slot, sort_order: 0, content: { text: heading } })
    .select("id,content").maybeSingle();
  return inserted.error || !inserted.data ? null : inserted.data as { id: string; content: ProfileContentBlock["content"] };
}

export async function changeEditorialSection(client: SupabaseClient, profileId: string,
  key: unknown, intent: unknown, form: FormData): Promise<Result> {
  const slot = sectionSlot(key);
  if (!slot) return { error: "Der Abschnitt wurde nicht gefunden." };
  if (intent !== "layout" && intent !== "section-toggle") return { error: "Die Aktion ist ungültig." };
  const row = await ensureSection(client, profileId, slot);
  if (!row) return { error: failed };
  const content = { ...row.content };
  if (intent === "section-toggle") content.hidden = content.hidden !== true;
  else {
    const old = normalizeTextBlockLayout(content.layout);
    const widthRaw = form.get("width_percent");
    const offsetRaw = form.get("offset_percent");
    const alignRaw = form.get("text_align");
    const topRaw = form.get("spacing_top");
    const bottomRaw = form.get("spacing_bottom");
    const width = widthRaw === null ? old.width_percent : Number(widthRaw);
    const offset = offsetRaw === null ? Math.min(old.offset_percent, 100 - width) : Number(offsetRaw);
    if (!validWidth(width) || !validOffset(offset) || width + offset > 100 ||
      alignRaw !== null && !validTextAlignment(alignRaw) ||
      topRaw !== null && !validSpacing(topRaw) || bottomRaw !== null && !validSpacing(bottomRaw))
      return { error: "Bitte wählen Sie eine gültige Breite, Position oder Ausrichtung." };
    content.layout = {
      width_percent: width, offset_percent: offset,
      text_align: alignRaw === null ? old.text_align : alignRaw,
      spacing_top: topRaw === null ? old.spacing_top : topRaw,
      spacing_bottom: bottomRaw === null ? old.spacing_bottom : bottomRaw,
    };
  }
  const saved = await client.from("profile_content_blocks").update({ content })
    .eq("profile_id", profileId).eq("slot", slot).eq("id", row.id).select("id").maybeSingle();
  return saved.error || saved.data?.id !== row.id ? { error: failed }
    : { success: intent === "section-toggle" ? content.hidden ? "Abschnitt ausgeblendet." : "Abschnitt eingeblendet." : "Layout gespeichert." };
}

export async function changeEditorialOrder(client: SupabaseClient, profileId: string,
  intent: unknown, form: FormData): Promise<Result> {
  const read = await client.from("profile_content_blocks").select("id,profile_id,type,slot,sort_order,content")
    .eq("profile_id", profileId).order("sort_order").order("id");
  if (read.error) return { error: failed };
  const blocks = (read.data ?? []) as ProfileContentBlock[];
  const order = editorialOrder(blocks);
  let next: string[];
  if (intent === "move") {
    const key = form.get("block_id");
    const direction = form.get("direction");
    if (typeof key !== "string" || !order.includes(key) ||
      direction !== "up" && direction !== "down") return { error: "Der Block wurde nicht gefunden." };
    const at = order.indexOf(key);
    const swap = at + (direction === "up" ? -1 : 1);
    if (swap < 0 || swap >= order.length) return { error: "Der Block kann nicht weiter verschoben werden." };
    next = [...order];
    [next[at], next[swap]] = [next[swap], next[at]];
  } else if (intent === "reorder") {
    const submitted = form.getAll("block_ids");
    if (submitted.some((value) => typeof value !== "string")) return { error: "Die Blockreihenfolge ist ungültig." };
    const ids = submitted as string[];
    const free = blocks.filter((block) => block.slot === null).map((block) => block.id);
    if (ids.length === free.length && ids.every((id) => isProfileId(id)) &&
      new Set(ids).size === free.length && ids.every((id) => free.includes(id))) {
      let index = 0;
      next = order.map((key) => key === ABOUT_SECTION || key === BUSINESS_SECTION ? key : ids[index++]);
    } else if (ids.length === order.length && new Set(ids).size === order.length &&
      ids.every((id) => order.includes(id))) next = ids;
    else return { error: "Die Blöcke haben sich geändert. Bitte laden Sie die Seite neu." };
  } else return { error: "Die Aktion ist ungültig." };
  const about = await ensureSection(client, profileId, "about_heading");
  if (!about) return { error: failed };
  const saved = await client.from("profile_content_blocks")
    .update({ content: { ...about.content, order: next } })
    .eq("profile_id", profileId).eq("slot", "about_heading").eq("id", about.id)
    .select("id").maybeSingle();
  return saved.error || saved.data?.id !== about.id ? { error: failed } : { success: "Die Reihenfolge wurde gespeichert." };
}
