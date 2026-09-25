export function imageCaptionPresentation(image: { caption?: string | null; alt_text?: string | null }) {
  const caption = image.caption?.trim() || null;
  return { caption, alt: caption ? "" : image.alt_text?.trim() || "" };
}

export function parseImageCaption(value: unknown): string | null | undefined {
  if (typeof value !== "string" || value.length > 500 || /[<>]/.test(value)) return undefined;
  return value.trim() || null;
}
