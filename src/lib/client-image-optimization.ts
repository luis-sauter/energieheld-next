import { MEDIA_MAX_BYTES } from "./company-media";

export const ORIGINAL_IMAGE_MAX_BYTES = 30 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_EDGE = 2400;
export const IMAGE_TARGET_BYTES = 2 * 1024 * 1024;

export async function optimizeProfileImage(file: File): Promise<File> {
  if (!file.size || file.size > ORIGINAL_IMAGE_MAX_BYTES)
    throw new Error("Bitte wählen Sie ein Bild mit maximal 30 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Bitte verwenden Sie JPG, PNG oder WebP.");

  let bitmap: ImageBitmap;
  try {
    // Browser decoding applies EXIF orientation before pixels reach the canvas.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Das Bild konnte nicht gelesen werden. Bitte wählen Sie eine andere Datei.");
  }
  try {
    if (Math.max(bitmap.width, bitmap.height) <= PROFILE_IMAGE_MAX_EDGE && file.size <= MEDIA_MAX_BYTES)
      return file;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: file.type === "image/png" });
    if (!context) throw new Error("Das Bild konnte auf diesem Gerät nicht verarbeitet werden.");
    const type = file.type;
    // Keep PNG alpha intact; lossy quality is only used for photographs.
    const edges = type === "image/png" ? [2400, 2000, 1600] : [2400, 2000];
    const qualities = type === "image/png" ? [undefined] : [0.9, 0.84, 0.76];
    let smallest: Blob | null = null;
    for (const edge of edges) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
        if (!blob) continue;
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= IMAGE_TARGET_BYTES || (type === "image/png" && blob.size <= MEDIA_MAX_BYTES))
          return new File([blob], file.name, { type, lastModified: file.lastModified });
      }
    }
    if (smallest && smallest.size <= MEDIA_MAX_BYTES)
      return new File([smallest], file.name, { type, lastModified: file.lastModified });
    throw new Error("Das Bild bleibt auch nach der Optimierung zu groß. Bitte wählen Sie ein anderes Bild.");
  } finally {
    bitmap.close();
  }
}
