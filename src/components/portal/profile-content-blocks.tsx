import type { ProfileContentBlock, ProfileBlockImage } from "@/lib/profile-content";
import Image from "next/image";
import { normalizeImageGridConfig, publicImageGridColumns } from "@/lib/image-grid-layout";
import { normalizeBlockLayout, normalizeTextBlockLayout } from "@/lib/content-block-layout";
import { imageCropStyle, type ImageCrop } from "@/lib/image-crop";
import { imageCaptionPresentation } from "@/lib/image-caption";
import styles from "./profile-content-blocks.module.css";
import { contentBlockRows, contentColumn } from "@/lib/content-block-rows";

export function ProfileBlockImage({ image, crop }: { image: ProfileBlockImage; crop?: ImageCrop }) {
  return <Image src={image.src} alt={imageCaptionPresentation(image).alt} fill unoptimized
    sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 25vw"
    style={imageCropStyle(crop ?? image)} />;
}

export function BlockImageGrid({ block }: { block: ProfileContentBlock }) {
  const images = block.images ?? [];
  if (!images.length) return null;
  const config = normalizeImageGridConfig(block.config);
  return <div className={styles.frame}>
    <div className={styles.grid} data-columns={publicImageGridColumns(config.columns, images.length)}>
    {images.map((image) => <figure key={image.id} className={styles.figure}>
      <div className={styles.tile} style={{ aspectRatio: config.aspect_ratio }}><ProfileBlockImage image={image} /></div>
      {imageCaptionPresentation(image).caption && <figcaption className={styles.caption}>{imageCaptionPresentation(image).caption}</figcaption>}
    </figure>)}
    </div>
  </div>;
}

export function ProfileContentBlocks({ blocks }: { blocks: ProfileContentBlock[] }) {
  const visible = blocks.filter((block) => block.type !== "image_grid" || block.images?.length);
  function renderBlock(block: ProfileContentBlock, paired: boolean) {
    const layout = normalizeBlockLayout(block.config);
    const align = block.type === "image_grid" ? undefined : normalizeTextBlockLayout(block.config).text_align;
    return <section className="detail-section profile-content-block" key={block.id}
      data-spacing-top={layout.spacing_top} data-spacing-bottom={layout.spacing_bottom}
      style={{ width: paired ? "100%" : `${layout.width_percent}%`, marginLeft: paired ? 0 : `${layout.offset_percent}%`, textAlign: align }}>
      {block.type === "heading" ? <h2>{block.content.text}</h2>
        : block.type === "text" ? <p>{block.content.text}</p> : <BlockImageGrid block={block} />}
    </section>;
  }
  return <>
    {contentBlockRows(visible).map((row) => row.right ? <div className={styles.contentRow} key={row.left[0].id}>
      {[row.left, row.right].map((column) => <div className={styles.contentColumn} key={column[0].id}
        style={{ gridColumn: contentColumn(column[0]) }}>{column.map((block) => renderBlock(block, true))}</div>)}
    </div> : row.left.map((block) => renderBlock(block, false)))}
  </>;
}
