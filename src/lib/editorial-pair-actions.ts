import type { SupabaseClient } from "@supabase/supabase-js";
import { isProfileId } from "./admin-review";
import { contentBlockRows } from "./content-block-rows";
import { normalizeTextBlockLayout, validOffset, validSpacing, validTextAlignment, validWidth } from "./content-block-layout";
import { ensureSection } from "./editorial-section-actions";
import { editorialOrder, type ProfileContentBlock } from "./profile-content";

type Pair = { members: ProfileContentBlock[]; order: string[] };
type Result = { error?: string; success?: string };
const failed = "Das Text-Bild-Paar konnte nicht gespeichert werden. Bitte laden Sie die Seite neu.";

export async function findEditorialPair(client: SupabaseClient, profileId: string,
  textId: unknown, imageId: unknown): Promise<Pair | null> {
  if (!isProfileId(textId) || !isProfileId(imageId)) return null;
  const read = await client.from("profile_content_blocks")
    .select("id,profile_id,type,slot,sort_order,content,config")
    .eq("profile_id", profileId).order("sort_order").order("id");
  if (read.error) return null;
  const blocks = (read.data ?? []) as ProfileContentBlock[];
  const order = editorialOrder(blocks);
  const free = order.map((id) => blocks.find((block) => block.id === id && block.slot === null))
    .filter((block): block is ProfileContentBlock => Boolean(block));
  for (const row of contentBlockRows(free)) {
    if (!row.right) continue;
    const members = [...row.left, ...row.right];
    if (!members.some((block) => block.id === textId && block.type === "text") ||
      !members.some((block) => block.id === imageId && block.type === "image_grid")) continue;
    const positions = members.map((block) => order.indexOf(block.id)).sort((a, b) => a - b);
    if (positions.some((at, index) => at !== positions[0] + index)) return null;
    return { members: members.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)), order };
  }
  return null;
}

export async function changeEditorialPair(client: SupabaseClient, profileId: string,
  intent: string, form: FormData): Promise<Result> {
  const pair = await findEditorialPair(client, profileId, form.get("text_block_id"), form.get("image_block_id"));
  if (!pair) return { error: "Text und Bild gehören nicht zu diesem Profil oder stehen nicht mehr nebeneinander." };
  const text = pair.members.find((block) => block.type === "text")!;
  const metadata = await ensureSection(client, profileId, "about_heading");
  if (!metadata) return { error: failed };
  const content = { ...metadata.content };
  const created: string[] = [];
  if (intent === "pair-frame") {
    const old = normalizeTextBlockLayout({ width_percent: 100, offset_percent: 0,
      text_align: normalizeTextBlockLayout(text.config).text_align, ...content.pair_layouts?.[text.id] });
    const widthRaw = form.get("width_percent");
    const width = widthRaw === null ? old.width_percent : Number(widthRaw);
    const offsetRaw = form.get("offset_percent");
    const offset = offsetRaw === null ? Math.min(old.offset_percent, 100 - width) : Number(offsetRaw);
    const align = form.get("text_align") ?? old.text_align;
    const top = form.get("spacing_top") ?? old.spacing_top;
    const bottom = form.get("spacing_bottom") ?? old.spacing_bottom;
    if (!validWidth(width) || !validOffset(offset) || width + offset > 100 ||
      !validTextAlignment(align) || !validSpacing(top) || !validSpacing(bottom))
      return { error: "Bitte wählen Sie gültige Werte für Breite, Position, Ausrichtung und Abstand." };
    content.pair_layouts = { ...content.pair_layouts, [text.id]: {
      width_percent: width, offset_percent: offset, text_align: align,
      spacing_top: top, spacing_bottom: bottom,
    } };
  } else if (intent === "pair-toggle") {
    const hidden = new Set(content.hidden_blocks ?? []);
    const allHidden = pair.members.every((block) => hidden.has(block.id));
    for (const block of pair.members) {
      if (allHidden) hidden.delete(block.id); else hidden.add(block.id);
    }
    content.hidden_blocks = [...hidden];
  } else if (intent === "pair-move") {
    const direction = form.get("direction");
    if (direction !== "up" && direction !== "down") return { error: "Die Richtung ist ungültig." };
    const ids = pair.members.map((block) => block.id);
    const first = pair.order.indexOf(ids[0]);
    const neighbor = direction === "up" ? first - 1 : first + ids.length;
    if (neighbor < 0 || neighbor >= pair.order.length) return { error: "Das Paar kann nicht weiter verschoben werden." };
    const next = pair.order.filter((id) => !ids.includes(id));
    next.splice(direction === "up" ? neighbor : neighbor - ids.length + 1, 0, ...ids);
    content.order = next;
  } else if (intent === "pair-duplicate") {
    for (const member of pair.members) {
      const copy = await client.rpc("duplicate_profile_content_block", {
        p_profile_id: profileId, p_block_id: member.id,
      });
      if (copy.error || !isProfileId(copy.data)) {
        for (const id of created) await client.from("profile_content_blocks").delete()
          .eq("profile_id", profileId).eq("id", id).is("slot", null);
        return { error: failed };
      }
      created.push(copy.data);
    }
    const ids = pair.members.map((block) => block.id);
    const next = [...pair.order];
    next.splice(next.indexOf(ids[ids.length - 1]) + 1, 0, ...created);
    content.order = next;
    const textCopy = created[pair.members.findIndex((block) => block.id === text.id)];
    if (content.pair_layouts?.[text.id]) content.pair_layouts = {
      ...content.pair_layouts, [textCopy]: content.pair_layouts[text.id],
    };
  } else return { error: "Die Aktion ist ungültig." };
  const saved = await client.from("profile_content_blocks").update({ content })
    .eq("profile_id", profileId).eq("id", metadata.id).eq("slot", "about_heading")
    .select("id").maybeSingle();
  if (saved.error || saved.data?.id !== metadata.id) {
    for (const id of created) await client.from("profile_content_blocks").delete()
      .eq("profile_id", profileId).eq("id", id).is("slot", null);
    return { error: failed };
  }
  return { success: intent === "pair-toggle" ? "Die Sichtbarkeit des Paars wurde geändert."
    : intent === "pair-duplicate" ? "Text und Bildplatz wurden dupliziert. Das neue Bild kann jetzt ergänzt werden."
      : intent === "pair-move" ? "Das Paar wurde verschoben." : "Das Paar-Layout wurde gespeichert." };
}
