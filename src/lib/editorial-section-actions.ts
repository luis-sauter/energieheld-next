import type { SupabaseClient } from "@supabase/supabase-js";
import { ABOUT_SECTION, BUSINESS_SECTION, contentText, editorialOrder, type HeadingSlot, type ProfileContentBlock } from "./profile-content";
import { normalizeTextBlockLayout, validOffset, validSpacing, validTextAlignment, validWidth } from "./content-block-layout";
import { isProfileId } from "./admin-review";

type Result = { error?: string; success?: string };
const failed = "Der redaktionelle Abschnitt konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";

export function sectionSlot(key: unknown): HeadingSlot | null {
  return key === ABOUT_SECTION ? "about_heading" : key === BUSINESS_SECTION ? "business_areas_heading" : null;
}

export async function ensureSection(client: SupabaseClient, profileId: string, slot: HeadingSlot) {
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
  if (!["layout", "section-pair-frame", "section-toggle", "section-delete", "section-restore", "section-duplicate"].includes(String(intent)))
    return { error: "Die Aktion ist ungültig." };
  const row = await ensureSection(client, profileId, slot);
  if (!row) return { error: failed };
  const content = { ...row.content };
  const metadata = await ensureSection(client, profileId, "about_heading");
  if (!metadata) return { error: failed };
  if (intent === "section-pair-frame") {
    if (!isProfileId(row.content.adjacent_image_id)) return { error: "Neben diesem Abschnitt steht kein Bild." };
    const old = normalizeTextBlockLayout(metadata.content.pair_layouts?.[key as string]);
    const width = form.get("width_percent") === null ? old.width_percent : Number(form.get("width_percent"));
    const offset = form.get("offset_percent") === null ? Math.min(old.offset_percent, 100 - width) : Number(form.get("offset_percent"));
    const align = form.get("text_align") ?? old.text_align;
    const top = form.get("spacing_top") ?? old.spacing_top;
    const bottom = form.get("spacing_bottom") ?? old.spacing_bottom;
    if (!validWidth(width) || !validOffset(offset) || width + offset > 100 ||
      !validTextAlignment(align) || !validSpacing(top) || !validSpacing(bottom))
      return { error: "Bitte wählen Sie gültige Werte für Breite, Position und Ausrichtung." };
    const saved = await client.from("profile_content_blocks").update({ content: {
      ...metadata.content, pair_layouts: { ...metadata.content.pair_layouts,
        [key as string]: { width_percent: width, offset_percent: offset, text_align: align,
          spacing_top: top, spacing_bottom: bottom } },
    } }).eq("profile_id", profileId).eq("id", metadata.id).eq("slot", "about_heading")
      .select("id").maybeSingle();
    return saved.error || saved.data?.id !== metadata.id ? { error: failed } : { success: "Layout gespeichert." };
  }
  const deleted = new Set(metadata.content.deleted_sections ?? []);
  if (intent === "section-delete") {
    if (deleted.has(key as string)) return { error: "Der Abschnitt wurde bereits gelöscht." };
    const field = slot === "about_heading" ? "description" : "business_areas";
    const prior = await client.from("company_profiles").select("description,business_areas")
      .eq("id", profileId).maybeSingle();
    if (prior.error || !prior.data) return { error: failed };
    const cleared = await client.from("company_profiles").update({ [field]: null })
      .eq("id", profileId).select("id").maybeSingle();
    if (cleared.error || cleared.data?.id !== profileId) return { error: failed };
    deleted.add(key as string);
    const pairLayouts = { ...metadata.content.pair_layouts };
    delete pairLayouts[key as string];
    const saved = await client.from("profile_content_blocks").update({ content: {
      ...metadata.content, pair_layouts: pairLayouts, deleted_sections: [...deleted],
      order: (metadata.content.order ?? []).filter((item) => item !== key),
    } }).eq("profile_id", profileId).eq("id", metadata.id).eq("slot", "about_heading").select("id").maybeSingle();
    if (saved.error || saved.data?.id !== metadata.id) {
      await client.from("company_profiles").update({ [field]: prior.data[field] })
        .eq("id", profileId);
      return { error: failed };
    }
    if (slot === "business_areas_heading" && row.id !== metadata.id) {
      const removed = await client.from("profile_content_blocks").delete().eq("profile_id", profileId)
        .eq("id", row.id).eq("slot", slot).select("id").maybeSingle();
      if (removed.error || removed.data?.id !== row.id) return { error: "Der Inhalt wurde entfernt, die Überschrift konnte nicht gelöscht werden. Bitte laden Sie die Seite neu." };
    }
    return { success: "Der Abschnitt und sein Inhalt wurden gelöscht." };
  }
  if (intent === "section-restore") {
    if (!deleted.has(key as string)) return { error: "Der Abschnitt ist bereits vorhanden." };
    deleted.delete(key as string);
    const saved = await client.from("profile_content_blocks").update({ content: {
      ...metadata.content, deleted_sections: [...deleted],
      order: [...(metadata.content.order ?? []), key as string],
    } }).eq("profile_id", profileId).eq("id", metadata.id).eq("slot", "about_heading").select("id").maybeSingle();
    return saved.error || saved.data?.id !== metadata.id ? { error: failed } : { success: "Der leere Abschnitt wurde wieder hinzugefügt." };
  }
  if (deleted.has(key as string)) return { error: "Der Abschnitt wurde bereits gelöscht." };
  if (intent === "section-duplicate") {
    const field = slot === "about_heading" ? "description" : "business_areas";
    const source = await client.from("company_profiles").select("description,business_areas").eq("id", profileId).maybeSingle();
    if (source.error || !source.data) return { error: failed };
    const body = source.data[field];
    const text = typeof body === "string" && body.trim() ? contentText(body, "text") : null;
    if (body && !text) return { error: "Der Abschnittstext ist für eine Kopie zu lang." };
    const created: string[] = [];
    const rollbackCreated = async () => {
      for (const id of created) await client.from("profile_content_blocks").delete()
        .eq("profile_id", profileId).eq("id", id).is("slot", null);
    };
    for (const [type, value] of [["heading", row.content.text], ...(text ? [["text", text]] : [])]) {
      const result = await client.rpc("insert_profile_content_block", {
        p_profile_id: profileId, p_type: type, p_text: value, p_before_block_id: null,
      });
      if (result.error || !isProfileId(result.data)) {
        for (const id of created) await client.from("profile_content_blocks").delete()
          .eq("profile_id", profileId).eq("id", id).is("slot", null);
        return { error: failed };
      }
      created.push(result.data);
    }
    for (const id of created) {
      const laidOut = await client.from("profile_content_blocks")
        .update({ config: normalizeTextBlockLayout(row.content.layout) })
        .eq("profile_id", profileId).eq("id", id).is("slot", null).select("id").maybeSingle();
      if (laidOut.error || laidOut.data?.id !== id) {
        for (const newId of created) await client.from("profile_content_blocks").delete()
          .eq("profile_id", profileId).eq("id", newId).is("slot", null);
        return { error: failed };
      }
    }
    let copiedImage: string | null = null;
    if (isProfileId(row.content.adjacent_image_id)) {
      const sourceImage = await client.from("profile_content_blocks").select("id,type,config")
        .eq("profile_id", profileId).eq("id", row.content.adjacent_image_id)
        .eq("type", "image_grid").is("slot", null).maybeSingle();
      if (sourceImage.error || !sourceImage.data) {
        await rollbackCreated();
        return { error: failed };
      }
      const copy = await client.rpc("duplicate_profile_content_block", {
        p_profile_id: profileId, p_block_id: sourceImage.data.id,
      });
      if (copy.error || !isProfileId(copy.data)) {
        await rollbackCreated();
        return { error: failed };
      }
      copiedImage = copy.data;
      created.push(copy.data);
    }
    const read = await client.from("profile_content_blocks").select("id,profile_id,type,slot,sort_order,content")
      .eq("profile_id", profileId).order("sort_order").order("id");
    if (read.error) {
      for (const id of created) await client.from("profile_content_blocks").delete()
        .eq("profile_id", profileId).eq("id", id).is("slot", null);
      return { error: failed };
    }
    const order = editorialOrder(read.data as ProfileContentBlock[]).filter((item) => !created.includes(item));
    const imageLeft = copiedImage && normalizeTextBlockLayout(row.content.layout).offset_percent > 0;
    order.splice(order.indexOf(key as string) + 1, 0,
      ...(imageLeft && copiedImage ? [copiedImage, ...created.filter((id) => id !== copiedImage)] : created));
    const pairLayouts = { ...metadata.content.pair_layouts };
    if (copiedImage && created.length >= 3 && pairLayouts[key as string])
      pairLayouts[created[1]] = pairLayouts[key as string];
    const saved = await client.from("profile_content_blocks").update({ content: {
      ...metadata.content, order, pair_layouts: pairLayouts,
    } })
      .eq("profile_id", profileId).eq("id", metadata.id).eq("slot", "about_heading").select("id").maybeSingle();
    if (saved.error || saved.data?.id !== metadata.id) {
      for (const id of created) await client.from("profile_content_blocks").delete()
        .eq("profile_id", profileId).eq("id", id).is("slot", null);
      return { error: failed };
    }
    return { success: "Der Abschnitt wurde darunter dupliziert." };
  }
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

export async function changeEditorialBlockVisibility(client: SupabaseClient, profileId: string, blockId: string): Promise<Result> {
  const block = await client.from("profile_content_blocks").select("id")
    .eq("profile_id", profileId).eq("id", blockId).is("slot", null).maybeSingle();
  if (block.error || !block.data) return { error: "Der Block wurde nicht gefunden." };
  const metadata = await ensureSection(client, profileId, "about_heading");
  if (!metadata) return { error: failed };
  const hidden = new Set(metadata.content.hidden_blocks ?? []);
  if (hidden.has(blockId)) hidden.delete(blockId); else hidden.add(blockId);
  const saved = await client.from("profile_content_blocks").update({ content: { ...metadata.content, hidden_blocks: [...hidden] } })
    .eq("profile_id", profileId).eq("id", metadata.id).eq("slot", "about_heading").select("id").maybeSingle();
  return saved.error || saved.data?.id !== metadata.id ? { error: failed }
    : { success: hidden.has(blockId) ? "Block ausgeblendet." : "Block eingeblendet." };
}

export async function forgetEditorialBlock(client: SupabaseClient, profileId: string, blockId: string): Promise<void> {
  for (const slot of ["about_heading", "business_areas_heading"] as const) {
    const section = await client.from("profile_content_blocks").select("id,content")
      .eq("profile_id", profileId).eq("slot", slot).maybeSingle();
    if (section.data?.content?.adjacent_image_id === blockId ||
      section.data?.content?.pending_image_id === blockId) {
      const content = { ...section.data.content };
      delete content.adjacent_image_id;
      delete content.pending_image_id;
      await client.from("profile_content_blocks").update({ content })
        .eq("profile_id", profileId).eq("id", section.data.id).eq("slot", slot);
    }
  }
  const row = await client.from("profile_content_blocks").select("id,content")
    .eq("profile_id", profileId).eq("slot", "about_heading").maybeSingle();
  if (!row.data?.content) return;
  const pairLayouts = { ...row.data.content.pair_layouts };
  delete pairLayouts[blockId];
  await client.from("profile_content_blocks").update({ content: {
    ...row.data.content,
    hidden_blocks: (row.data.content.hidden_blocks ?? []).filter((id: string) => id !== blockId),
    order: (row.data.content.order ?? []).filter((id: string) => id !== blockId),
    pair_layouts: pairLayouts,
  } }).eq("profile_id", profileId).eq("id", row.data.id).eq("slot", "about_heading");
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
    const unit = (id: string) => {
      for (const [sectionKey, slot] of [[ABOUT_SECTION, "about_heading"],
        [BUSINESS_SECTION, "business_areas_heading"]] as const) {
        const imageId = blocks.find((block) => block.slot === slot)?.content.adjacent_image_id;
        if (imageId && (id === sectionKey || id === imageId) &&
          Math.abs(order.indexOf(sectionKey) - order.indexOf(imageId)) === 1)
          return [sectionKey, imageId].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      }
      return [id];
    };
    const moving = unit(key);
    const start = order.indexOf(moving[0]);
    const neighborAt = direction === "up" ? start - 1 : start + moving.length;
    if (neighborAt < 0 || neighborAt >= order.length) return { error: "Der Block kann nicht weiter verschoben werden." };
    const neighbor = unit(order[neighborAt]);
    const from = Math.min(start, order.indexOf(neighbor[0]));
    next = [...order];
    next.splice(from, moving.length + neighbor.length,
      ...(direction === "up" ? [...moving, ...neighbor] : [...neighbor, ...moving]));
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
