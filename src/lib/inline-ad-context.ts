import { portalAdAreaLabel, portalAdSection } from "./ad-target-areas";
import type { AdTarget, AdPlacementId, ActiveAd } from "./ad-values";

export type InlineAdContext = {
  path: string;
  label: string;
  target_type: "homepage" | "experts_directory" | "portal_area";
  target_key: string | null;
};

export function inlineAdContext(path: string, registeredArea = false): InlineAdContext | null {
  if (path === "/") return { path, label: "Startseite", target_type: "homepage", target_key: null };
  if (path === "/unterkuenfte-a-z") return { path, label: "Unterkünfte A–Z", target_type: "experts_directory", target_key: null };
  const key = path.slice(1);
  return path.startsWith("/") && (portalAdSection(key) || registeredArea) && /^(mottoreisen|reiseziele)(\/[a-z0-9-]+)?$/.test(key)
    ? { path, label: portalAdSection(key) ? portalAdAreaLabel(key) : key.split('/').at(-1)!.replaceAll('-', ' '), target_type: "portal_area", target_key: key }
    : null;
}

export function matchesInlineAdContext(target: AdTarget, context: InlineAdContext) {
  return target.target_type === context.target_type && !target.category_id &&
    (target.target_key ?? null) === context.target_key;
}

export type InlineBanner = {
  profileId?: string | null;
  profileName?: string;
  crop?: import("./image-crop").ImageCrop;
  image_width?: number; image_height?: number; mobile_image?: ActiveAd["mobile_image"];
  id: string;
  placement: AdPlacementId;
  target_url: string;
  imageUrl?: string;
  shared: boolean;
  source?: "legacy" | "campaign";
  editorial?: boolean;
  size?: import("./banner-presentation").BannerSize;
  legacy_source?: AdPlacementId;
  metadata?: import('./banner-search-metadata').BannerSearchMetadata;
};
export type InlineBannerResult = {
  error?: string;
  success?: string;
  campaignId?: string;
  uploadPath?: string;
  ad?: ActiveAd;
  removed?: boolean;
  warning?: string;
  metadata?: import('./banner-search-metadata').BannerSearchMetadata;
};
export type InlineBannerOptions = {
  advertisers?: import('./banner-search-metadata').BannerAdvertiserOption[];
  label: string;
  banners: InlineBanner[];
  availability: Record<string, string>;
  error?: string;
  terms?: import('./banner-search-metadata').BannerSearchTerm[];
  archived?: { id: string; name: string }[];
  archive?: (form: FormData) => Promise<InlineBannerResult>;
  reuse?: (form: FormData) => Promise<InlineBannerResult>;
  saveCrop?: (form: FormData) => Promise<InlineBannerResult>;
  saveMetadata?: (form: FormData) => Promise<InlineBannerResult>;
  prepare: (form: FormData) => Promise<InlineBannerResult>;
  save: (form: FormData) => Promise<InlineBannerResult>;
  remove: (form: FormData) => Promise<InlineBannerResult>;
  reorder?: (sources: import("./sidebar-order").SidebarSlot[], expected?: string[]) => Promise<InlineBannerResult>;
};
