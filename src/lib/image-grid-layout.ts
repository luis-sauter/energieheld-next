export type ImageGridConfig = {
  columns: number;
  width_percent: number;
  aspect_ratio: number;
};

export const DEFAULT_IMAGE_GRID_SIZE = { width_percent: 100, aspect_ratio: 1.5 } as const;

export function hasPersistedImageGridSize(value: unknown): value is ImageGridConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  return Number.isInteger(config.columns) && Number(config.columns) >= 1 && Number(config.columns) <= 4 &&
    Number.isInteger(config.width_percent) && Number(config.width_percent) >= 35 && Number(config.width_percent) <= 100 &&
    typeof config.aspect_ratio === "number" && Number.isFinite(config.aspect_ratio) &&
    config.aspect_ratio >= 0.6 && config.aspect_ratio <= 3 &&
    Math.abs(config.aspect_ratio * 100 - Math.round(config.aspect_ratio * 100)) < 1e-8;
}

export function normalizeImageGridConfig(value: unknown): ImageGridConfig {
  const config = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const columns = Number.isInteger(config.columns) && Number(config.columns) >= 1 && Number(config.columns) <= 4
    ? Number(config.columns) : 1;
  return {
    columns,
    width_percent: Number.isInteger(config.width_percent) && Number(config.width_percent) >= 35 && Number(config.width_percent) <= 100
      ? Number(config.width_percent) : DEFAULT_IMAGE_GRID_SIZE.width_percent,
    aspect_ratio: typeof config.aspect_ratio === "number" && Number.isFinite(config.aspect_ratio) &&
      config.aspect_ratio >= 0.6 && config.aspect_ratio <= 3
      ? Math.round(config.aspect_ratio * 100) / 100 : DEFAULT_IMAGE_GRID_SIZE.aspect_ratio,
  };
}

export function parseImageGridSize(width: unknown, ratio: unknown) {
  if (typeof width !== "string" || !/^(?:[0-9]{2,3})$/.test(width) ||
    typeof ratio !== "string" || !/^[0-9](?:\.[0-9]{1,2})?$/.test(ratio)) return null;
  const width_percent = Number(width);
  const aspect_ratio = Number(ratio);
  if (width_percent < 35 || width_percent > 100 || aspect_ratio < 0.6 || aspect_ratio > 3)
    return null;
  return { width_percent, aspect_ratio };
}

export function imageGridSlots<T>(columns: number, images: T[]): (T | null)[] {
  const count = Number.isInteger(columns) && columns >= 1 && columns <= 4 ? columns : 1;
  return Array.from({ length: count }, (_, index) => images[index] ?? null);
}

export function publicImageGridColumns(columns: number, imageCount: number) {
  return Math.max(1, Math.min(columns, imageCount));
}

export function resizeImageGridFromPointer(start: {
  width: number; ratio: number; parentWidth: number; tileWidth: number;
}, deltaX: number, deltaY: number) {
  const width = Math.max(35, Math.min(100,
    Math.round(start.width + deltaX / start.parentWidth * 100)));
  const tileWidth = start.tileWidth * width / start.width;
  // Horizontal movement keeps the image shape; vertical movement changes it.
  const tileHeight = Math.max(1, tileWidth / start.ratio + deltaY);
  const ratio = Math.max(0.6, Math.min(3, Math.round(tileWidth / tileHeight * 100) / 100));
  return { width, ratio };
}
