import { portalAdAreaLabel, portalAdSection } from "./ad-target-areas";
import type { AdTarget, AdPlacementId, ActiveAd } from "./ad-values";

export type InlineAdContext = {
  path: string;
  label: string;
  target_type: "homepage" | "experts_directory" | "portal_area";
  target_key: string | null;
};

export function inlineAdContext(path: string): InlineAdContext | null {
  if (path === "/") return { path, label: "Startseite", target_type: "homepage", target_key: null };
  if (path === "/unterkuenfte-a-z") return { path, label: "Unterkünfte A–Z", target_type: "experts_directory", target_key: null };
  const key = path.slice(1);
  return path.startsWith("/") && portalAdSection(key)
    ? { path, label: portalAdAreaLabel(key), target_type: "portal_area", target_key: key }
    : null;
}

export function matchesInlineAdContext(target: AdTarget, context: InlineAdContext) {
  return target.target_type === context.target_type && !target.category_id &&
    (target.target_key ?? null) === context.target_key;
}

export type InlineBanner = {
  id: string;
  placement: AdPlacementId;
  target_url: string;
  imageUrl?: string;
  shared: boolean;
  source?: "legacy" | "campaign";
  editorial?: boolean;
  size?: import("./banner-presentation").BannerSize;
  legacy_source?: AdPlacementId;
};
export type InlineBannerResult = {
  error?: string;
  success?: string;
  campaignId?: string;
  uploadPath?: string;
  ad?: ActiveAd;
  removed?: boolean;
  warning?: string;
};
export type InlineBannerOptions = {
  label: string;
  banners: InlineBanner[];
  availability: Record<string, string>;
  error?: string;
  prepare: (form: FormData) => Promise<InlineBannerResult>;
  save: (form: FormData) => Promise<InlineBannerResult>;
  remove: (form: FormData) => Promise<InlineBannerResult>;
  reorder?: (sources: import("./sidebar-order").SidebarSlot[], expected?: string[]) => Promise<InlineBannerResult>;
};
