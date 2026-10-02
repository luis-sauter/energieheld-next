import type { ProfileContentBlock, ProfileBlockImage, EditorialItem } from "@/lib/profile-content";
import type { Listing } from "@/types/portal";
import Image from "next/image";
import { normalizeImageGridConfig, publicImageGridColumns } from "@/lib/image-grid-layout";
import { normalizeBlockLayout, normalizeTextBlockLayout, type TextAlignment } from "@/lib/content-block-layout";
import { imageCropStyle, type ImageCrop } from "@/lib/image-crop";
import { imageCaptionPresentation } from "@/lib/image-caption";
import styles from "./profile-content-blocks.module.css";
import { contentBlockRows } from "@/lib/content-block-rows";

// Shared public/editor composition; DOM order defines mobile reading order.
export function TextImageSection({ text, image, textWidth, imageWidth, imageFirst, textAlign }: {
  text: React.ReactNode; image: React.ReactNode; textWidth: number; imageWidth: number;
  imageFirst: boolean; textAlign?: TextAlignment;
}) {
  const textColumn = <div key="text" className={styles.editorialText} style={{ textAlign }}>{text}</div>;
  const imageColumn = <div key="image" className={styles.editorialImage}>{image}</div>;
  return <div className={styles.editorialPair} data-text-image="true" data-image-side={imageFirst ? "left" : "right"}
    style={{ gridTemplateColumns: imageFirst
      ? `minmax(0, ${imageWidth}fr) minmax(0, ${textWidth}fr)`
      : `minmax(0, ${textWidth}fr) minmax(0, ${imageWidth}fr)` }}>
    {imageFirst ? [imageColumn, textColumn] : [textColumn, imageColumn]}
  </div>;
}

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
        <TextImageSection
          text={[...row.left, ...row.right].filter((block) => block.type !== "image_grid").map((block) => renderBlock(block, true))}
          image={[...row.left, ...row.right].filter((block) => block.type === "image_grid").map((block) => <BlockImageGrid key={block.id} block={block} />)}
          textWidth={normalizeBlockLayout(text?.config).width_percent}
          imageWidth={normalizeBlockLayout([...row.left, ...row.right].find((block) => block.type === "image_grid")?.config).width_percent}
          imageFirst={row.left[0].type === "image_grid"} textAlign={frame.text_align} />
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
    if (item.hidden || !body && (!item.hasHeadingRow || item.headingHidden) && !item.imageBlock?.images?.length) continue;
    const section = <section key={item.key} className="detail-section profile-content-block profile-editorial-section"
      data-spacing-top={item.layout.spacing_top} data-spacing-bottom={item.layout.spacing_bottom}
      style={{ width: item.imageBlock ? "100%" : `${item.layout.width_percent}%`,
        marginLeft: item.imageBlock ? 0 : `${item.layout.offset_percent}%`, textAlign: item.layout.text_align }}>
      {!item.headingHidden && <h2 style={{ textAlign: item.headingAlign }}>{item.heading}</h2>}
      {body && <p style={{ textAlign: item.bodyAlign,
        ...(item.kind === "business" ? { whiteSpace: "pre-wrap" } : {}) }}>{body}</p>}
    </section>;
    if (!item.imageBlock?.images?.length) { sections.push(section); continue; }
    const image = item.imageBlock;
    const frame = item.pairLayout ?? normalizeTextBlockLayout(undefined);
    sections.push(<div key={item.key} className="profile-content-block"
      data-spacing-top={frame.spacing_top} data-spacing-bottom={frame.spacing_bottom}
      style={{ width: `${frame.width_percent}%`, marginLeft: `${frame.offset_percent}%`, textAlign: frame.text_align }}>
      <TextImageSection text={section} image={<BlockImageGrid block={image} />}
        textWidth={item.layout.width_percent} imageWidth={normalizeBlockLayout(image.config).width_percent}
        imageFirst={normalizeBlockLayout(image.config).offset_percent < item.layout.offset_percent} />
    </div>);
  }
  flush();
  return <>{sections}</>;
}
