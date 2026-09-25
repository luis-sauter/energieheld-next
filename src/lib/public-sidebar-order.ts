import "server-only";
import { createPublicClient } from "./supabase/public";
import { defaultSidebarOrder, orderedSidebarSlots, type SidebarSlot } from "./sidebar-order";

export async function loadPublicSidebarOrder(): Promise<SidebarSlot[]> {
  try {
    const { data, error } = await createPublicClient()
      .from("ad_sidebar_slot_order")
      .select("slot,sort_order")
      .order("sort_order");
    if (error || !data) return [...defaultSidebarOrder];
    return orderedSidebarSlots(data);
  } catch {
    return [...defaultSidebarOrder];
  }
}
