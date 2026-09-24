import type { ProfileContentBlock } from "@/lib/profile-content";
import Image from "next/image";
import { normalizeImageGridConfig, publicImageGridColumns } from "@/lib/image-grid-layout";
import styles from "./profile-content-blocks.module.css";

export function BlockImageGrid({ block }: { block: ProfileContentBlock }) {
  const images = block.images ?? [];
  if (!images.length) return null;
  const config = normalizeImageGridConfig(block.config);
  return <div className={`${styles.frame} ${styles.publicFrame}`} style={{ width: `${config.width_percent}%` }}>
    <div className={styles.grid} data-columns={publicImageGridColumns(config.columns, images.length)}>
    {images.map((image) => <div key={image.id} className={styles.tile} style={{ aspectRatio: config.aspect_ratio }}>
      <Image src={image.src} alt={image.alt_text ?? ""} fill unoptimized
        sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 25vw" />
    </div>)}
    </div>
  </div>;
}

export function ProfileContentBlocks({ blocks }: { blocks: ProfileContentBlock[] }) {
  return <>
    {blocks.filter((block) => block.type !== "image_grid" || block.images?.length).map((block) => <section className="detail-section profile-content-block" key={block.id}>
      {block.type === "heading"
        ? <h2>{block.content.text}</h2>
        : block.type === "text" ? <p>{block.content.text}</p> : <BlockImageGrid block={block} />}
    </section>)}
  </>;
}
