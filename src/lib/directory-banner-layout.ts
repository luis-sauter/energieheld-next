import type { ActiveAd } from "./ad-values";
import { adTargetUrl, berlinToday } from "./ad-values";

export type CreativeSample = { bits: string; color: number[]; pixels: number[] };
export type CreativeSamples = Record<string, CreativeSample[]>;
export function directoryImageKey(ad: ActiveAd) {
  if (ad.image_path) return ad.image_path;
  try { const url = new URL(ad.imageUrl!, "https://das-reiseportal.com"); return url.origin + url.pathname; } catch { return ad.imageUrl ?? ""; }
}
export function sameCreative(a: CreativeSample[], b: CreativeSample[]) {
  return a.some(x => b.some(y => x.bits.length === y.bits.length &&
    [...x.bits].filter((bit, i) => bit !== y.bits[i]).length <= 2 &&
    x.color.every((value, i) => Math.abs(value - y.color[i]) <= 6) &&
    x.pixels.reduce((sum, value, i) => sum + Math.abs(value - y.pixels[i]), 0) / x.pixels.length <= 5));
}
// Reuse already loaded public pixels, not Storage downloads or catalog lookups.
export function sampleDirectoryCreative(image: HTMLImageElement): CreativeSample[] {
  try {
    const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !image.naturalWidth || !image.naturalHeight) return [];
    return [0, .05, .1, .15, .2].map(inset => {
      context.drawImage(image, image.naturalWidth * inset, image.naturalHeight * inset,
        image.naturalWidth * (1 - 2 * inset), image.naturalHeight * (1 - 2 * inset), 0, 0, 8, 8);
      const pixels = context.getImageData(0, 0, 8, 8).data;
      const gray = Array.from({ length: 64 }, (_, i) => (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3);
      const mean = gray.reduce((sum, value) => sum + value, 0) / 64;
      return { bits: gray.map(value => value >= mean ? "1" : "0").join(""),
        pixels: Array.from({ length: 192 }, (_, i) => pixels[Math.floor(i / 3) * 4 + i % 3]),
        color: [0, 1, 2].map(channel => gray.reduce((sum, _, i) => sum + pixels[i * 4 + channel], 0) / 64) };
    });
  } catch { return []; } // Cross-origin failure never creates extra requests or drops a valid ad.
}

// Inputs come from the existing active-slot/search delivery; never load additional campaigns.
export function directoryBannerPool(ads: ActiveAd[], samples: CreativeSamples = {}, today = berlinToday()) {
  const seen = new Set<string>();
  const paths = new Set<string>();
  const accepted: CreativeSample[][] = [];
  return ads.filter(ad => {
    const key = directoryImageKey(ad), fingerprint = samples[key];
    if (ad.suppressed || !ad.imageUrl || !adTargetUrl(ad.target_url) || ad.status && ad.status !== "approved" ||
      ad.approved_start_date && ad.approved_start_date > today || ad.approved_end_date && ad.approved_end_date < today || seen.has(ad.id) || paths.has(key) ||
      fingerprint?.length && accepted.some(previous => sameCreative(previous, fingerprint))) return false;
    seen.add(ad.id); paths.add(key); if (fingerprint?.length) accepted.push(fingerprint); return true;
  });
}
