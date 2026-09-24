import type { SupabaseClient } from "@supabase/supabase-js";
import { isProfileId, type AdminAccess } from "./admin-review";
import { checkInlineProfileTarget } from "./inline-admin-profile";
import { contentText, type ContentBlockType, type HeadingSlot } from "./profile-content";
import { MEDIA_BUCKET } from "./company-media";

export type ContentActionResult = { access: AdminAccess; error?: string; success?: string };
const missing = "Der Inhaltsblock gehört nicht zu diesem Profil oder wurde bereits entfernt.";
const failed = "Die Änderung konnte nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.";

export async function changeAdminProfileContent(
  client: SupabaseClient,
  profileId: unknown,
  slug: unknown,
  form: FormData,
): Promise<ContentActionResult> {
  const target = await checkInlineProfileTarget(client, profileId, slug);
  if (target.access !== "admin" || target.error) return target;
  const id = profileId as string;
  const intent = form.get("intent");

  if (intent === "heading") {
    const slot = form.get("slot");
    if (slot !== "about_heading" && slot !== "business_areas_heading")
      return { access: "admin", error: "Die Überschrift ist ungültig." };
    const headingSlot: HeadingSlot = slot;
    const raw = form.get("text");
    if (typeof raw !== "string") return { access: "admin", error: "Bitte geben Sie eine Überschrift ein." };
    const value = raw.trim();
    if (value && !contentText(value, "heading"))
      return { access: "admin", error: "Die Überschrift darf höchstens 200 Zeichen lang sein." };
    const { data: current, error: readError } = await client.from("profile_content_blocks")
      .select("id").eq("profile_id", id).eq("slot", headingSlot).maybeSingle();
    if (readError) return { access: "admin", error: failed };
    if (!value) {
      if (current) {
        const { data, error } = await client.from("profile_content_blocks")
          .delete().eq("profile_id", id).eq("id", current.id).eq("slot", headingSlot)
          .select("id").maybeSingle();
        if (error || data?.id !== current.id) return { access: "admin", error: failed };
      }
      return { access: "admin", success: "Die Standardüberschrift ist wiederhergestellt." };
    }
    if (current) {
      const { data, error } = await client.from("profile_content_blocks")
        .update({ content: { text: value } }).eq("profile_id", id).eq("id", current.id)
        .eq("slot", headingSlot).select("id").maybeSingle();
      return error || data?.id !== current.id
        ? { access: "admin", error: failed }
        : { access: "admin", success: "Die Überschrift wurde gespeichert." };
    }
    const { data, error } = await client.from("profile_content_blocks")
      .insert({ profile_id: id, type: "heading", slot: headingSlot, sort_order: 0, content: { text: value } })
      .select("id").maybeSingle();
    return error || !data?.id
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Die Überschrift wurde gespeichert." };
  }

  if (intent === "insert") {
    const type = form.get("type");
    if (type !== "heading" && type !== "text" && type !== "image_grid")
      return { access: "admin", error: "Bitte wählen Sie Überschrift, Text oder Bilder." };
    const blockType: ContentBlockType = type;
    const value = blockType === "image_grid" ? "" : contentText(form.get("text"), blockType);
    if (value === null) return { access: "admin", error: "Bitte geben Sie gültigen Inhalt ein." };
    const before = form.get("before_block_id");
    if (before !== null && before !== "" && !isProfileId(before))
      return { access: "admin", error: missing };
    const { data, error } = await client.rpc("insert_profile_content_block", {
      p_profile_id: id, p_type: blockType, p_text: value,
      p_before_block_id: before || null,
    });
    return error || !isProfileId(data)
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Der Inhaltsblock wurde hinzugefügt." };
  }

  const blockId = form.get("block_id");
  if (!isProfileId(blockId)) return { access: "admin", error: missing };
  if (intent === "move") {
    const direction = form.get("direction");
    if (direction !== "up" && direction !== "down")
      return { access: "admin", error: "Die Sortieraktion ist ungültig." };
    const { data, error } = await client.from("profile_content_blocks")
      .select("id").eq("profile_id", id).is("slot", null)
      .order("sort_order").order("id");
    if (error) return { access: "admin", error: failed };
    const ids = (data ?? []).map((row) => row.id);
    const index = ids.indexOf(blockId);
    const swap = index + (direction === "up" ? -1 : 1);
    if (index < 0) return { access: "admin", error: missing };
    if (swap < 0 || swap >= ids.length)
      return { access: "admin", error: "Der Block kann nicht weiter verschoben werden." };
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
    const result = await client.rpc("reorder_profile_content_blocks", {
      p_profile_id: id, p_block_ids: ids,
    });
    return result.error
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Die Reihenfolge wurde gespeichert." };
  }

  if (intent !== "update" && intent !== "delete")
    return { access: "admin", error: "Die Aktion ist ungültig." };
  const { data: block, error: readError } = await client.from("profile_content_blocks")
    .select("id,type,slot").eq("profile_id", id).eq("id", blockId).maybeSingle();
  if (readError) return { access: "admin", error: failed };
  if (!block || block.slot !== null) return { access: "admin", error: missing };
  if (intent === "delete") {
    if (block.type === "image_grid") {
      const { data: images, error: imagesError } = await client.from("profile_content_block_images")
        .select("id").eq("block_id", blockId);
      if (imagesError) return { access: "admin", error: failed };
      for (const image of images ?? []) {
        const { error: removeError } = await client.rpc("remove_profile_block_image", {
          p_profile_id: id, p_block_id: blockId, p_image_id: image.id,
        });
        if (removeError) return { access: "admin", error: failed };
      }
      // Include objects left by an interrupted upload or an earlier failed cleanup.
      // Keep the block if Storage is unavailable, so the same scoped path can be retried.
      const prefix = `profiles/${id}/blocks/${blockId}`;
      const storage = client.storage.from(MEDIA_BUCKET);
      for (let attempt = 0; attempt < 10; attempt++) {
        const listed = await storage.list(prefix, { limit: 100 });
        if (listed.error || !listed.data) return { access: "admin", error: failed };
        const paths = listed.data.filter((item) =>
          /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(item.name)
        ).map((item) => `${prefix}/${item.name}`);
        if (paths.length !== listed.data.length) return { access: "admin", error: failed };
        if (!paths.length) break;
        const removed = await storage.remove(paths);
        if (removed.error) return { access: "admin", error: failed };
        if (attempt === 9) return { access: "admin", error: failed };
      }
    }
    const { data, error } = await client.from("profile_content_blocks")
      .delete().eq("profile_id", id).eq("id", blockId).is("slot", null)
      .select("id").maybeSingle();
    return error || data?.id !== blockId
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Der Block wurde gelöscht." };
  }
  if (block.type === "image_grid")
    return { access: "admin", error: "Dieser Bildblock wird über seine Bildsteuerung bearbeitet." };
  const value = contentText(form.get("text"), block.type);
  if (!value) return { access: "admin", error: "Bitte geben Sie gültigen Inhalt ein." };
  const { data, error } = await client.from("profile_content_blocks")
    .update({ content: { text: value } }).eq("profile_id", id).eq("id", blockId)
    .is("slot", null).select("id").maybeSingle();
  return error || data?.id !== blockId
    ? { access: "admin", error: failed }
    : { access: "admin", success: "Der Block wurde gespeichert." };
}
