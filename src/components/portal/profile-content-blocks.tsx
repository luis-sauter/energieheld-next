import type { ProfileContentBlock } from "@/lib/profile-content";
import Image from "next/image";
import styles from "./profile-content-blocks.module.css";

export function BlockImageGrid({ block }: { block: ProfileContentBlock }) {
  const images = block.images ?? [];
  if (!images.length) return null;
  return <div className={styles.grid} data-columns={block.config?.columns ?? 1}>
    {images.map((image) => <div key={image.id} className={styles.tile}>
      <Image src={image.src} alt={image.alt_text ?? ""} fill unoptimized
        sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 25vw" />
    </div>)}
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
