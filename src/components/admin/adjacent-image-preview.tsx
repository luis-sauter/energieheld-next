import Image from "next/image";
import { adjacentImageLayout, type ImageShare, type ImageSide } from "@/lib/adjacent-image-layout";
import styles from "./inline-profile.module.css";

export function AdjacentImagePreview({ text, side, share, previewUrl }: {
  text: string; side: ImageSide; share: ImageShare; previewUrl?: string;
}) {
  const layout = adjacentImageLayout(side, share);
  if (!layout) return null;
  return <div className={styles.adjacentPreview} aria-label="Vorschau Text und Bild">
    <div className={styles.adjacentPreviewText}
      style={{ gridColumn: `${layout.textOffset + 1} / span ${layout.textWidth}` }}>{text}</div>
    <div className={styles.adjacentPreviewImage}
      style={{ gridColumn: `${layout.imageOffset + 1} / span ${layout.imageWidth}` }}>
      {previewUrl ? <Image src={previewUrl} alt="Ausgewähltes Bild" fill unoptimized /> : "Bildvorschau"}
    </div>
  </div>;
}
