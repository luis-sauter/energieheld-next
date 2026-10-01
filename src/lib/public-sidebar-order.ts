import "server-only";
import { defaultSidebarOrder, type SidebarSlot } from "./sidebar-order";

export async function loadPublicSidebarOrder(): Promise<SidebarSlot[]> {
  return [...defaultSidebarOrder];
}
