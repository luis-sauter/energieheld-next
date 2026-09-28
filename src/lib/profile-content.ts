import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageGridConfig } from "./image-grid-layout";
import { normalizeTextBlockLayout, type TextBlockLayout } from "./content-block-layout";
import type { ImageCrop } from "./image-crop";

export type ContentBlockType = "heading" | "text" | "image_grid";
export type TextBlockType = Exclude<ContentBlockType, "image_grid">;
export type HeadingSlot = "about_heading" | "business_areas_heading";
export const ABOUT_SECTION = "section:about";
export const BUSINESS_SECTION = "section:business";
export type EditorialSectionKey = typeof ABOUT_SECTION | typeof BUSINESS_SECTION;
export type ProfileBlockImage = Partial<ImageCrop> & {
  id: string;
  block_id: string;
  alt_text: string | null;
  caption?: string | null;
  sort_order: number;
  src: string;
};
export type ProfileContentBlock = {
  id: string;
  profile_id: string;
  type: ContentBlockType;
  slot: HeadingSlot | null;
  sort_order: number;
  content: { text: string; layout?: Partial<TextBlockLayout>; hidden?: boolean; order?: string[] };
  config?: Partial<ImageGridConfig & TextBlockLayout>;
  images?: ProfileBlockImage[];
};

export function contentText(value: unknown, type: TextBlockType) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= (type === "heading" ? 200 : 10000)
    ? text : null;
}

export function splitProfileContent(blocks: ProfileContentBlock[], profileName: string) {
  const about = blocks.find((block) => block.slot === "about_heading")?.content.text;
  const business = blocks.find((block) => block.slot === "business_areas_heading")?.content.text;
  return {
    aboutHeading: about || `Über ${profileName}`,
    businessHeading: business || "Tätigkeitsbereiche",
    blocks: blocks.filter((block) => block.slot === null)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    items: editorialItems(blocks, profileName),
  };
}

export type EditorialItem = {
  key: string;
  kind: "about" | "business" | "block";
  heading: string;
  hidden: boolean;
  layout: TextBlockLayout;
  block?: ProfileContentBlock;
};

export function editorialItems(blocks: ProfileContentBlock[], profileName: string): EditorialItem[] {
  const normal = blocks.filter((block) => block.slot === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const about = blocks.find((block) => block.slot === "about_heading");
  const business = blocks.find((block) => block.slot === "business_areas_heading");
  const map = new Map<string, EditorialItem>([
    [ABOUT_SECTION, { key: ABOUT_SECTION, kind: "about", heading: about?.content.text || `Über ${profileName}`,
      hidden: about?.content.hidden === true, layout: normalizeTextBlockLayout(about?.content.layout) }],
    [BUSINESS_SECTION, { key: BUSINESS_SECTION, kind: "business", heading: business?.content.text || "Tätigkeitsbereiche",
      hidden: business?.content.hidden === true, layout: normalizeTextBlockLayout(business?.content.layout) }],
    ...normal.map((block): [string, EditorialItem] => [block.id, { key: block.id, kind: "block",
      heading: "", hidden: false, layout: normalizeTextBlockLayout(block.config), block }]),
  ]);
  const order = editorialOrder(blocks);
  return order.map((key) => map.get(key)).filter((item): item is EditorialItem => Boolean(item));
}

export function editorialOrder(blocks: ProfileContentBlock[]): string[] {
  const normal = blocks.filter((block) => block.slot === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const saved = blocks.find((block) => block.slot === "about_heading")?.content.order;
  if (!Array.isArray(saved)) return [ABOUT_SECTION, ...normal.map((block) => block.id), BUSINESS_SECTION];
  const allowed = new Set([ABOUT_SECTION, BUSINESS_SECTION, ...normal.map((block) => block.id)]);
  const order = saved.filter((key): key is string => typeof key === "string" && allowed.delete(key));
  if (!order.includes(ABOUT_SECTION)) order.unshift(ABOUT_SECTION);
  if (!order.includes(BUSINESS_SECTION)) order.push(BUSINESS_SECTION);
  for (const block of normal) {
    if (!allowed.has(block.id)) continue;
    const next = normal.find((candidate) => candidate.sort_order > block.sort_order && order.includes(candidate.id));
    const at = next ? order.indexOf(next.id) : order.indexOf(BUSINESS_SECTION);
    order.splice(at < 0 ? order.length : at, 0, block.id);
    allowed.delete(block.id);
  }
  return order;
}

export async function loadPublicProfileContent(client: SupabaseClient, profileId: string) {
  try {
    const { data, error } = await client.from("profile_content_blocks")
      .select("id,profile_id,type,slot,sort_order,content,config")
      .eq("profile_id", profileId)
      .order("sort_order")
      .order("id");
    if (error) throw error;
    const blocks = ((data ?? []) as ProfileContentBlock[]).filter((block) =>
      ((block.type === "heading" || block.type === "text") && typeof block.content?.text === "string" ||
        block.type === "image_grid" && block.slot === null &&
        Number.isInteger(block.config?.columns) && (block.config?.columns ?? 0) >= 1 && (block.config?.columns ?? 0) <= 4) &&
      (block.slot === null || block.slot === "about_heading" || block.slot === "business_areas_heading")
    );
    let imagesAvailable = true;
    try {
      const imageBlocks = blocks.filter((block) => block.type === "image_grid");
      if (imageBlocks.length) {
        // SELECT * stays compatible with databases that do not yet have crop columns.
        // Only the safe presentation fields below are sent to the client.
        const { data: rows, error: imageError } = await client.from("profile_content_block_images")
          .select("*")
          .in("block_id", imageBlocks.map((block) => block.id))
          .order("sort_order").order("id");
        if (imageError) throw imageError;
        const paths = (rows ?? []).map((row) => row.storage_path as string);
        const signed = paths.length
          ? await client.storage.from("company-media").createSignedUrls(paths, 3600)
          : { data: [], error: null };
        if (signed.error || signed.data?.some((item) => item.error || !item.signedUrl))
          throw new Error("Image signing unavailable");
        const urls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
        for (const block of imageBlocks) block.images = (rows ?? [])
          .filter((row) => row.block_id === block.id &&
            typeof row.storage_path === "string" &&
            row.storage_path.startsWith(`profiles/${profileId}/blocks/${block.id}/`) &&
            urls.has(row.storage_path))
          .map((row) => ({
            id: row.id, block_id: row.block_id, alt_text: row.alt_text,
            ...("caption" in row ? { caption: typeof row.caption === "string" ? row.caption : null } : {}),
            sort_order: row.sort_order, src: urls.get(row.storage_path)!,
            ...(typeof row.focus_x === "number" && typeof row.focus_y === "number" && typeof row.zoom === "number"
              ? { focus_x: row.focus_x, focus_y: row.focus_y, zoom: row.zoom } : {}),
          }));
      } else {
        // Probe independently: a pre-migration environment still renders text blocks.
        const probe = await client.from("profile_content_block_images").select("id").limit(1);
        if (probe.error) imagesAvailable = false;
      }
    } catch { imagesAvailable = false; }
    return { blocks, available: true, imagesAvailable };
  } catch {
    // The page must retain its structured content before this repository-only migration is deployed.
    return { blocks: [] as ProfileContentBlock[], available: false, imagesAvailable: false };
  }
}
