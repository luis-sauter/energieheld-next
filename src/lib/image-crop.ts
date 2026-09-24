export type ImageCrop = { focus_x: number; focus_y: number; zoom: number };
export const DEFAULT_IMAGE_CROP: ImageCrop = { focus_x: 50, focus_y: 50, zoom: 1 };

const validFocus = (value: unknown) => typeof value === "number" && Number.isFinite(value) &&
  value >= 0 && value <= 100 && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
const validZoom = (value: unknown) => typeof value === "number" && Number.isFinite(value) &&
  value >= 1 && value <= 3 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;

export function hasPersistedImageCrop(value: unknown): value is ImageCrop {
  if (!value || typeof value !== "object") return false;
  const crop = value as Record<string, unknown>;
  return validFocus(crop.focus_x) && validFocus(crop.focus_y) && validZoom(crop.zoom);
}

export function normalizeImageCrop(value: unknown): ImageCrop {
  return hasPersistedImageCrop(value)
    ? { focus_x: value.focus_x, focus_y: value.focus_y, zoom: value.zoom }
    : { ...DEFAULT_IMAGE_CROP };
}

export function parseImageCrop(focusX: unknown, focusY: unknown, zoom: unknown): ImageCrop | null {
  if (typeof focusX !== "string" || typeof focusY !== "string" || typeof zoom !== "string" ||
    !/^(?:\d{1,3})(?:\.\d)?$/.test(focusX) || !/^(?:\d{1,3})(?:\.\d)?$/.test(focusY) ||
    !/^\d(?:\.\d{1,2})?$/.test(zoom)) return null;
  const crop = { focus_x: Number(focusX), focus_y: Number(focusY), zoom: Number(zoom) };
  return hasPersistedImageCrop(crop) ? crop : null;
}

export function imageCropStyle(value: unknown) {
  const { focus_x, focus_y, zoom } = normalizeImageCrop(value);
  // The image already covers its clipped frame. Scaling by >= 1 around a point
  // inside that frame keeps every edge covered without altering the source file.
  return {
    objectFit: "cover" as const,
    objectPosition: `${focus_x}% ${focus_y}%`,
    transform: `scale(${zoom})`,
    transformOrigin: `${focus_x}% ${focus_y}%`,
  };
}

export function panImageCrop(start: ImageCrop, deltaX: number, deltaY: number, width: number, height: number): ImageCrop {
  if (width <= 0 || height <= 0) return start;
  const sensitivity = 1 / Math.max(start.zoom - 1, 0.5);
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));
  return {
    ...start,
    focus_x: clamp(start.focus_x - deltaX / width * 100 * sensitivity),
    focus_y: clamp(start.focus_y - deltaY / height * 100 * sensitivity),
  };
}

export function zoomImageCrop(crop: ImageCrop, change: number): ImageCrop {
  return { ...crop, zoom: Math.max(1, Math.min(3, Math.round((crop.zoom + change) * 100) / 100)) };
}

export function centerImageCrop(crop: ImageCrop): ImageCrop {
  return { ...crop, focus_x: 50, focus_y: 50 };
}

export function nudgeImageCrop(crop: ImageCrop, direction: "left" | "right" | "up" | "down"): ImageCrop {
  const axis = direction === "left" || direction === "right" ? "focus_x" : "focus_y";
  const change = direction === "left" || direction === "up" ? 5 : -5;
  return { ...crop, [axis]: Math.max(0, Math.min(100, Math.round((crop[axis] + change) * 10) / 10)) };
}
