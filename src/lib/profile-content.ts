import {VIDEO_BUCKET,isProfileVideoPath} from './profile-video';
import {externalVideoEmbed} from './external-video';
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageGridConfig } from "./image-grid-layout";
import { normalizeTextBlockLayout, type TextAlignment, type TextBlockLayout } from "./content-block-layout";
import type { ImageCrop } from "./image-crop";

export type ContentBlockType = "heading" | "text" | "image_grid" | "video";
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
  content: { text: string; title?:string; layout?: Partial<TextBlockLayout>; hidden?: boolean; order?: string[];
    hidden_blocks?: string[]; deleted_sections?: string[]; pair_layouts?: Record<string, Partial<TextBlockLayout>>;
    adjacent_image_id?: string; pending_image_id?: string; heading_align?: TextAlignment;
    body_align?: TextAlignment; heading_hidden?: boolean };
  config?: Partial<ImageGridConfig & TextBlockLayout>;
  images?: ProfileBlockImage[];
  video?: {src:string;external?:boolean};
  pair_layout?: Partial<TextBlockLayout>;
};

export function contentText(value: unknown, type: TextBlockType) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return (text.length > 0 || type === "video") && text.length <= (type === "heading" ? 200 : 10000)
    ? text : null;
}

export function splitProfileContent(blocks: ProfileContentBlock[], profileName: string) {
  const pairLayouts = blocks.find((block) => block.slot === "about_heading")?.content.pair_layouts ?? {};
  const prepared = blocks.map((block) => block.slot === null && block.type === "text"
    ? { ...block, pair_layout: pairLayouts[block.id] } : block);
  const about = blocks.find((block) => block.slot === "about_heading")?.content.text;
  const business = blocks.find((block) => block.slot === "business_areas_heading")?.content.text;
  return {
    aboutHeading: about || `Über ${profileName}`,
    businessHeading: business || "Tätigkeitsbereiche",
    blocks: prepared.filter((block) => block.slot === null)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    items: editorialItems(prepared, profileName),
  };
}

export type EditorialItem = {
  key: string;
  kind: "about" | "business" | "block";
  heading: string;
  headingAlign: TextAlignment;
  bodyAlign: TextAlignment;
  headingHidden: boolean;
  hasHeadingRow: boolean;
  hidden: boolean;
  layout: TextBlockLayout;
  block?: ProfileContentBlock;
  imageBlock?: ProfileContentBlock;
  pairLayout?: TextBlockLayout;
};

export function editorialItems(blocks: ProfileContentBlock[], profileName: string): EditorialItem[] {
  const normal = blocks.filter((block) => block.slot === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const about = blocks.find((block) => block.slot === "about_heading");
  const business = blocks.find((block) => block.slot === "business_areas_heading");
  const hiddenBlocks = new Set(about?.content.hidden_blocks ?? []);
  const deleted = new Set(about?.content.deleted_sections ?? []);
  const map = new Map<string, EditorialItem>([
    [ABOUT_SECTION, { key: ABOUT_SECTION, kind: "about", heading: about?.content.text || `Über ${profileName}`,
      headingAlign: about?.content.heading_align ?? normalizeTextBlockLayout(about?.content.layout).text_align,
      bodyAlign: about?.content.body_align ?? normalizeTextBlockLayout(about?.content.layout).text_align,
      headingHidden: about?.content.heading_hidden === true,
      hasHeadingRow: Boolean(about),
      hidden: about?.content.hidden === true, layout: normalizeTextBlockLayout(about?.content.layout) }],
    [BUSINESS_SECTION, { key: BUSINESS_SECTION, kind: "business", heading: business?.content.text || "Tätigkeitsbereiche",
      headingAlign: business?.content.heading_align ?? normalizeTextBlockLayout(business?.content.layout).text_align,
      bodyAlign: business?.content.body_align ?? normalizeTextBlockLayout(business?.content.layout).text_align,
      headingHidden: business?.content.heading_hidden === true,
      hasHeadingRow: Boolean(business),
      hidden: business?.content.hidden === true, layout: normalizeTextBlockLayout(business?.content.layout) }],
    ...normal.map((block): [string, EditorialItem] => [block.id, { key: block.id, kind: "block",
      heading: "", headingAlign: "left", bodyAlign: "left", headingHidden: false, hasHeadingRow: false,
      hidden: hiddenBlocks.has(block.id), layout: normalizeTextBlockLayout(block.config), block }]),
  ]);
  for (const key of deleted) map.delete(key);
  const order = editorialOrder(blocks);
  const paired = new Set<string>();
  for (const [key, section] of [[ABOUT_SECTION, about], [BUSINESS_SECTION, business]] as const) {
    const imageId = section?.content.adjacent_image_id;
    const image = normal.find((block) => block.id === imageId && block.type === "image_grid");
    const at = order.indexOf(key);
    if (image && at >= 0 && Math.abs(order.indexOf(image.id) - at) === 1 && map.has(key)) {
      map.get(key)!.imageBlock = image;
      map.get(key)!.pairLayout = normalizeTextBlockLayout(about?.content.pair_layouts?.[key]);
      paired.add(image.id);
    }
  }
  return order.filter((key) => !paired.has(key)).map((key) => map.get(key))
    .filter((item): item is EditorialItem => Boolean(item));
}

export function editorialOrder(blocks: ProfileContentBlock[]): string[] {
  const normal = blocks.filter((block) => block.slot === null)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const metadata = blocks.find((block) => block.slot === "about_heading")?.content;
  const deleted = new Set(metadata?.deleted_sections ?? []);
  const sections = [ABOUT_SECTION, BUSINESS_SECTION].filter((key) => !deleted.has(key));
  const saved = metadata?.order;
  if (!Array.isArray(saved)) return [
    ...(sections.includes(ABOUT_SECTION) ? [ABOUT_SECTION] : []),
    ...normal.map((block) => block.id),
    ...(sections.includes(BUSINESS_SECTION) ? [BUSINESS_SECTION] : []),
  ];
  const allowed = new Set([...sections, ...normal.map((block) => block.id)]);
  const order = saved.filter((key): key is string => typeof key === "string" && allowed.delete(key));
  if (sections.includes(ABOUT_SECTION) && !order.includes(ABOUT_SECTION)) order.unshift(ABOUT_SECTION);
  if (sections.includes(BUSINESS_SECTION) && !order.includes(BUSINESS_SECTION)) order.push(BUSINESS_SECTION);
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
      ((block.type === "heading" || block.type === "text" || block.type === "video") && typeof block.content?.text === "string" ||
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
            /^profiles\/[0-9a-f-]{36}\/blocks\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(row.storage_path) &&
            row.storage_path.startsWith(`profiles/${profileId}/blocks/`) &&
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
    const videoBlocks = blocks.filter(block => block.type === 'video');
    if (videoBlocks.length) {
      const refs = await client.from('profile_video_uses').select('block_id,storage_path,external_url').eq('profile_id',profileId).in('block_id',videoBlocks.map(block=>block.id));
      if (!refs.error) {
        const paths = (refs.data ?? []).map(row=>row.storage_path).filter((path):path is string=>typeof path==='string' && isProfileVideoPath(profileId,path));
        const signed = paths.length ? await client.storage.from(VIDEO_BUCKET).createSignedUrls(paths,3600) : {data:[],error:null};
        const urls = new Map((signed.data ?? []).map(row=>[row.path,row.signedUrl]));
        for (const block of videoBlocks) { const ref=refs.data?.find(row=>row.block_id===block.id);
          if (ref?.external_url && externalVideoEmbed(ref.external_url)) block.video={src:ref.external_url,external:true};
          else if (ref?.storage_path && urls.get(ref.storage_path)) block.video={src:urls.get(ref.storage_path)!};
        }
      }
    }
    return { blocks, available: true, imagesAvailable };
  } catch {
    // The page must retain its structured content before this repository-only migration is deployed.
    return { blocks: [] as ProfileContentBlock[], available: false, imagesAvailable: false };
  }
}
