import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentBlockType = "heading" | "text";
export type HeadingSlot = "about_heading" | "business_areas_heading";
export type ProfileContentBlock = {
  id: string;
  profile_id: string;
  type: ContentBlockType;
  slot: HeadingSlot | null;
  sort_order: number;
  content: { text: string };
};

export function contentText(value: unknown, type: ContentBlockType) {
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
  };
}

export async function loadPublicProfileContent(client: SupabaseClient, profileId: string) {
  try {
    const { data, error } = await client.from("profile_content_blocks")
      .select("id,profile_id,type,slot,sort_order,content")
      .eq("profile_id", profileId)
      .order("sort_order")
      .order("id");
    if (error) throw error;
    const blocks = ((data ?? []) as ProfileContentBlock[]).filter((block) =>
      (block.type === "heading" || block.type === "text") &&
      typeof block.content?.text === "string" &&
      (block.slot === null || block.slot === "about_heading" || block.slot === "business_areas_heading")
    );
    return { blocks, available: true };
  } catch {
    // The page must retain its structured content before this repository-only migration is deployed.
    return { blocks: [] as ProfileContentBlock[], available: false };
  }
}
