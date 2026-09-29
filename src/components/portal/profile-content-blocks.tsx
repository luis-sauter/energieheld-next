import type { ProfileContentBlock, ProfileBlockImage, EditorialItem } from "@/lib/profile-content";
import type { Listing } from "@/types/portal";
import Image from "next/image";
import { normalizeImageGridConfig, publicImageGridColumns } from "@/lib/image-grid-layout";
import { normalizeBlockLayout, normalizeTextBlockLayout, type TextAlignment } from "@/lib/content-block-layout";
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
  function renderBlock(block: ProfileContentBlock, paired: boolean, groupAlign?: TextAlignment) {
    const layout = normalizeBlockLayout(block.config);
    const align = block.type === "image_grid" ? undefined : normalizeTextBlockLayout(block.config).text_align;
    return <section className="detail-section profile-content-block" key={block.id}
      data-spacing-top={layout.spacing_top} data-spacing-bottom={layout.spacing_bottom}
      style={{ width: paired ? "100%" : `${layout.width_percent}%`, marginLeft: paired ? 0 : `${layout.offset_percent}%`, textAlign: groupAlign ?? align }}>
      {block.type === "heading" ? <h2>{block.content.text}</h2>
        : block.type === "text" ? <p>{block.content.text}</p> : <BlockImageGrid block={block} />}
    </section>;
  }
  return <>
    {contentBlockRows(visible).map((row) => {
      if (!row.right) return row.left.map((block) => renderBlock(block, false));
      const text = [...row.left, ...row.right].find((block) => block.type === "text");
      const frame = normalizeTextBlockLayout({ width_percent: 100, offset_percent: 0,
        text_align: normalizeTextBlockLayout(text?.config).text_align, ...text?.pair_layout });
      return <div key={row.left[0].id} className="profile-content-block" data-spacing-top={frame.spacing_top} data-spacing-bottom={frame.spacing_bottom}
        style={{ width: `${frame.width_percent}%`, marginLeft: `${frame.offset_percent}%`, textAlign: frame.text_align }}>
        <div className={styles.contentRow}>
          {[row.left, row.right].map((column) => <div className={styles.contentColumn} key={column[0].id}
            style={{ gridColumn: contentColumn(column[0]) }}>{column.map((block) => renderBlock(block, true, frame.text_align))}</div>)}
        </div>
      </div>;
    })}
  </>;
}

export function ProfileEditorialContent({ items, listing }: { items: EditorialItem[]; listing: Listing }) {
  const sections: React.ReactNode[] = [];
  let pending: ProfileContentBlock[] = [];
  function flush() {
    if (!pending.length) return;
    sections.push(<ProfileContentBlocks key={`blocks-${pending[0].id}`} blocks={pending} />);
    pending = [];
  }
  for (const item of items) {
    if (item.kind === "block") {
      if (item.hidden) flush();
      else if (item.block) pending.push(item.block);
      continue;
    }
    flush();
    const body = item.kind === "about" ? listing.description : listing.businessAreas;
    if (item.hidden || !body) continue;
    const section = <section key={item.key} className="detail-section profile-content-block profile-editorial-section"
      data-spacing-top={item.layout.spacing_top} data-spacing-bottom={item.layout.spacing_bottom}
      style={{ width: item.imageBlock ? "100%" : `${item.layout.width_percent}%`,
        marginLeft: item.imageBlock ? 0 : `${item.layout.offset_percent}%`, textAlign: item.layout.text_align }}>
      <h2>{item.heading}</h2><p style={item.kind === "business" ? { whiteSpace: "pre-wrap" } : undefined}>{body}</p>
    </section>;
    if (!item.imageBlock?.images?.length) { sections.push(section); continue; }
    const image = item.imageBlock;
    const frame = item.pairLayout ?? normalizeTextBlockLayout(undefined);
    sections.push(<div key={item.key} className="profile-content-block"
      data-spacing-top={frame.spacing_top} data-spacing-bottom={frame.spacing_bottom}
      style={{ width: `${frame.width_percent}%`, marginLeft: `${frame.offset_percent}%`, textAlign: frame.text_align }}>
      <div className={styles.contentRow}>
      <div className={styles.contentColumn} style={{ gridColumn: `${item.layout.offset_percent + 1} / span ${item.layout.width_percent}` }}>{section}</div>
      <div className={styles.contentColumn} style={{ gridColumn: contentColumn(image) }}><BlockImageGrid block={image} /></div>
      </div>
    </div>);
  }
  flush();
  return <>{sections}</>;
}
