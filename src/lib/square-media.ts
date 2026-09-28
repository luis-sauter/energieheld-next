import { ORIGINAL_IMAGE_MAX_BYTES } from "./client-image-optimization";
import type { ImageCrop } from "./image-crop";

export const SQUARE_MEDIA_SIZE = 400;

export async function squareMediaFile(file: File, kind: "logo" | "gallery", crop: ImageCrop): Promise<File> {
  if (!file.size || file.size > ORIGINAL_IMAGE_MAX_BYTES)
    throw new Error("Bitte wählen Sie ein Bild mit maximal 30 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Bitte verwenden Sie JPG, PNG oder WebP.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Das Bild konnte nicht gelesen werden."); }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SQUARE_MEDIA_SIZE;
    const context = canvas.getContext("2d", { alpha: kind === "logo" });
    if (!context) throw new Error("Das Bild konnte auf diesem Gerät nicht verarbeitet werden.");
    const fit = kind === "logo" ? Math.min : Math.max;
    const scale = fit(SQUARE_MEDIA_SIZE / bitmap.width, SQUARE_MEDIA_SIZE / bitmap.height) * crop.zoom;
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    const x = (SQUARE_MEDIA_SIZE - width) * crop.focus_x / 100;
    const y = (SQUARE_MEDIA_SIZE - height) * crop.focus_y / 100;
    if (kind === "gallery") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, SQUARE_MEDIA_SIZE, SQUARE_MEDIA_SIZE);
    }
    context.drawImage(bitmap, x, y, width, height);
    const type = kind === "logo" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    if (!blob) throw new Error("Der Bildausschnitt konnte nicht erstellt werden.");
    return new File([blob], `profile-${kind}.${kind === "logo" ? "png" : "jpg"}`, { type });
  } finally { bitmap.close(); }
}
