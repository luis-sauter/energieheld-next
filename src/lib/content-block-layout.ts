export type BlockSpacing = "small" | "normal" | "large";
export type TextAlignment = "left" | "center" | "right";
export type BlockLayout = {
  width_percent: number;
  offset_percent: number;
  spacing_top: BlockSpacing;
  spacing_bottom: BlockSpacing;
};
export type TextBlockLayout = BlockLayout & { text_align: TextAlignment };

export const DEFAULT_BLOCK_LAYOUT: TextBlockLayout = {
  width_percent: 100, offset_percent: 0, text_align: "left",
  spacing_top: "normal", spacing_bottom: "normal",
};

export function hasPersistedBlockLayout(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return validWidth(v.width_percent) && validOffset(v.offset_percent) &&
    v.width_percent + v.offset_percent <= 100 &&
    validSpacing(v.spacing_top) && validSpacing(v.spacing_bottom);
}

export function validWidth(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 25 && value <= 100;
}
export function validOffset(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
    Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}
export function validSpacing(value: unknown): value is BlockSpacing {
  return value === "small" || value === "normal" || value === "large";
}
export function validTextAlignment(value: unknown): value is TextAlignment {
  return value === "left" || value === "center" || value === "right";
}
export function normalizeBlockLayout(value: unknown): BlockLayout {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const width = validWidth(v.width_percent) ? v.width_percent : 100;
  const offset = validOffset(v.offset_percent) ? Math.min(v.offset_percent, 100 - width) : 0;
  return {
    width_percent: width, offset_percent: offset,
    spacing_top: validSpacing(v.spacing_top) ? v.spacing_top : "normal",
    spacing_bottom: validSpacing(v.spacing_bottom) ? v.spacing_bottom : "normal",
  };
}
export function normalizeTextBlockLayout(value: unknown): TextBlockLayout {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { ...normalizeBlockLayout(value), text_align: validTextAlignment(v.text_align) ? v.text_align : "left" };
}
export function clampBlockOffset(width: number, offset: number) {
  return Math.max(0, Math.min(100 - width, Math.round(offset * 10) / 10));
}
export function blockPositionOffset(width: number, position: TextAlignment) {
  return position === "left" ? 0 : position === "right" ? 100 - width : (100 - width) / 2;
}
export function dragBlockOffset(startOffset: number, width: number, deltaX: number, containerWidth: number) {
  if (containerWidth <= 0) return { offset: startOffset, snap: null };
  const raw = clampBlockOffset(width, startOffset + deltaX / containerWidth * 100);
  for (const position of ["left", "center", "right"] as const) {
    const target = blockPositionOffset(width, position);
    if (Math.abs(raw - target) <= 3) return { offset: target, snap: position };
  }
  return { offset: raw, snap: null };
}
