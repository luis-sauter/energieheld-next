import type { SupabaseClient } from "@supabase/supabase-js";
import { isProfileId } from "./admin-review";
import { adjacentImageLayout } from "./adjacent-image-layout";
import { normalizeImageGridConfig } from "./image-grid-layout";
import { normalizeTextBlockLayout } from "./content-block-layout";
import { ABOUT_SECTION, BUSINESS_SECTION, editorialOrder, type ProfileContentBlock } from "./profile-content";
import { changeEditorialOrder } from "./editorial-section-actions";

type Result = { error?: string; success?: string; blockId?: string };
const failed = "Text und Bild konnten nicht angeordnet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.";

export async function changeAdminAdjacentImage(client: SupabaseClient, profileId: string,
  intent: unknown, form: FormData): Promise<Result> {
  const textId = form.get("text_block_id");
  const imageId = form.get("image_block_id");
  const layout = adjacentImageLayout(form.get("image_side"), Number(form.get("image_width")));
  if (!layout) return { error: "Bitte wählen Sie Bildposition und Breite (25, 50 oder 75 %)." };
  if (!isProfileId(textId) || intent === "pair-layout" && !isProfileId(imageId))
    return { error: "Der Text- oder Bildblock wurde nicht gefunden." };
  const read = await client.from("profile_content_blocks")
    .select("id,profile_id,type,slot,sort_order,content,config")
    .eq("profile_id", profileId).order("sort_order").order("id");
  if (read.error) return { error: failed };
  const blocks = (read.data ?? []) as ProfileContentBlock[];
  const text = blocks.find((block) => block.id === textId && block.slot === null && block.type === "text");
  if (!text || !text.config) return { error: "Der Textblock wurde nicht gefunden." };
  const order = editorialOrder(blocks);
  const textAt = order.indexOf(text.id);
  if (textAt < 0) return { error: failed };
  const previous = blocks.find((block) => block.id === order[textAt - 1]);
  const heading = previous?.type === "heading" && previous.slot === null &&
    normalizeTextBlockLayout(previous.config).width_percent === normalizeTextBlockLayout(text.config).width_percent &&
    normalizeTextBlockLayout(previous.config).offset_percent === normalizeTextBlockLayout(text.config).offset_percent
    ? previous : null;
  const groupStart = heading ? textAt - 1 : textAt;
  let image = blocks.find((block) => block.id === imageId && block.slot === null && block.type === "image_grid");
  if (intent === "pair-layout") {
    if (!image) return { error: "Der Bildblock wurde nicht gefunden." };
    const imageAt = order.indexOf(image.id);
    if (imageAt !== groupStart - 1 && imageAt !== textAt + 1)
      return { error: "Text und Bild stehen nicht nebeneinander. Bitte laden Sie die Seite neu." };
  } else if (intent === "pair-image") {
    for (const neighbor of [order[groupStart - 1], order[textAt + 1]]) {
      if (blocks.some((block) => block.id === neighbor && block.type === "image_grid"))
        return { error: "Neben diesem Text steht bereits ein Bildblock." };
    }
    const free = blocks.filter((block) => block.slot === null);
    const position = free.findIndex((block) => block.id === textId);
    const before = free[position + 1]?.id ?? null;
    const inserted = await client.rpc("insert_profile_content_block", {
      p_profile_id: profileId, p_type: "image_grid", p_text: "", p_before_block_id: before,
    });
    if (inserted.error || !isProfileId(inserted.data)) return { error: failed };
    image = { id: inserted.data, profile_id: profileId, type: "image_grid", slot: null,
      sort_order: text.sort_order + 1, content: { text: "" }, config: {
        columns: 1, width_percent: 100, offset_percent: 0, aspect_ratio: 1.5,
        spacing_top: "normal", spacing_bottom: "normal",
      } };
  } else return { error: "Die Aktion ist ungültig." };
  if (!image) return { error: failed };

  const nextOrder = order.filter((key) => key !== image.id);
  const target = layout.side === "left" ? nextOrder.indexOf(heading?.id ?? text.id)
    : nextOrder.indexOf(text.id) + 1;
  nextOrder.splice(target, 0, image.id);
  async function saveOrder() {
    const reorder = new FormData();
    for (const key of nextOrder) reorder.append("block_ids", key);
    return changeEditorialOrder(client, profileId, "reorder", reorder);
  }
  if (intent === "pair-image") {
    // Keep the public text layout untouched until the existing secure upload succeeds.
    const ordered = await saveOrder();
    if (ordered.error) {
      await client.from("profile_content_blocks").delete()
        .eq("profile_id", profileId).eq("id", image.id).is("slot", null);
      return { error: failed };
    }
    return { success: "Bildplatz angelegt.", blockId: image.id };
  }
  const saved: ProfileContentBlock[] = [];
  async function update(block: ProfileContentBlock, config: Record<string, unknown>) {
    const result = await client.from("profile_content_blocks").update({ config })
      .eq("profile_id", profileId).eq("id", block.id).is("slot", null).select("id").maybeSingle();
    if (result.error || result.data?.id !== block.id) return false;
    saved.push(block);
    return true;
  }
  async function rollback() {
    for (const block of saved.reverse()) await client.from("profile_content_blocks").update({ config: block.config })
      .eq("profile_id", profileId).eq("id", block.id).is("slot", null);
  }
  const imageConfig = { ...normalizeImageGridConfig(image.config),
    width_percent: layout.imageWidth, offset_percent: layout.imageOffset };
  const textConfig = { ...normalizeTextBlockLayout(text.config),
    width_percent: layout.textWidth, offset_percent: layout.textOffset };
  if (!await update(image, imageConfig) || !await update(text, textConfig) ||
    heading && !await update(heading, { ...normalizeTextBlockLayout(heading.config),
      width_percent: layout.textWidth, offset_percent: layout.textOffset })) {
    await rollback();
    return { error: failed };
  }
  if (nextOrder.includes(ABOUT_SECTION) && nextOrder.includes(BUSINESS_SECTION)) {
    const result = await saveOrder();
    if (result.error) {
      await rollback();
      return { error: failed };
    }
  }
  return { success: "Text und Bild angeordnet.", blockId: image.id };
}
