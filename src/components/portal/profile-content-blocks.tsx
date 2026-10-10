import { Children, cloneElement, isValidElement, type ReactNode, type CSSProperties } from "react";
import {PortalVideo} from './portal-video';
import type { ProfileContentBlock, ProfileBlockImage, EditorialItem } from "@/lib/profile-content";
import type { Listing } from "@/types/portal";
import Image from "next/image";
import { normalizeImageGridConfig, publicImageGridColumns, editorialImageAspectRatio } from "@/lib/image-grid-layout";
import { normalizeBlockLayout, normalizeTextBlockLayout, type TextAlignment, type TextImageFlow, splitFlowText } from "@/lib/content-block-layout";
import { imageCropStyle, type ImageCrop } from "@/lib/image-crop";
import { imageCaptionPresentation } from "@/lib/image-caption";
import styles from "./profile-content-blocks.module.css";
import { contentBlockRows } from "@/lib/content-block-rows";


function flowIntroduction(nodes: ReactNode) {
  let started = false;
  function divide(node: ReactNode): {intro: ReactNode; body: ReactNode} {
    if (!isValidElement<{children?: ReactNode}>(node)) return {intro: null, body: node};
    if (!started && (node.type === "h2" || node.type === "h3")) return {intro: node, body: null};
    if (!started && node.type === "p" && typeof node.props.children === "string") {
      started = true;
      const parts = splitFlowText(node.props.children);
      return {intro: parts.intro ? cloneElement(node, {}, parts.intro) : null,
        body: parts.body ? cloneElement(node, {}, parts.body) : null};
    }
    if (!started && node.props.children) {
      const parts = Children.toArray(node.props.children).map(divide);
      const intro = parts.map(p => p.intro).filter(Boolean), body = parts.map(p => p.body).filter(Boolean);
      return {intro: intro.length ? cloneElement(node, {}, intro) : null, body: body.length ? cloneElement(node, {}, body) : null};
    }
    return {intro: null, body: node};
  }
  const parts = Children.toArray(nodes).map(divide);
  return {intro: parts.map(p => p.intro), body: parts.map(p => p.body)};
}

// One contained surface, shared by public view and editor; no content is truncated.
export function TextImageSection({ text, image, textWidth, imageWidth, imageFirst, textAlign, flow = "standard", editingText }: {
  text: ReactNode; image: ReactNode; textWidth: number; imageWidth: number;
  imageFirst: boolean; textAlign?: TextAlignment; flow?: TextImageFlow; editingText?: ReactNode;
}) {
  const split = flow === "around" || flow === "columns" ? flowIntroduction(text) : null;
  const textColumn = <div key="text" className={styles.editorialText} style={{ textAlign }}>{split?.body ?? text}</div>;
  const imageColumn = <div key="image" className={styles.editorialImage}>{image}</div>;
  return <>
    <div className={styles.editorialPair} data-text-image="true" data-flow={flow} data-image-side={imageFirst ? "left" : "right"}
      style={{ "--image-share": imageWidth / (textWidth + imageWidth) * 100 + "%", gridTemplateColumns: imageFirst
        ? "minmax(0, " + imageWidth + "fr) minmax(0, " + textWidth + "fr)"
        : "minmax(0, " + textWidth + "fr) minmax(0, " + imageWidth + "fr)" } as CSSProperties}>
      {split && <div className={styles.flowIntro}>{split.intro}</div>}
      {flow === "beside" || flow === "around" ? [imageColumn, textColumn] : imageFirst ? [imageColumn, textColumn] : [textColumn, imageColumn]}
    </div>
    {editingText && flow !== "standard" && <details className={styles.flowTextEditor}><summary>Text bearbeiten</summary>{editingText}</details>}
  </>;
}

export function ProfileBlockImage({ image, crop }: { image: ProfileBlockImage; crop?: ImageCrop }) {
  return <Image src={image.src} alt={imageCaptionPresentation(image).alt} fill unoptimized
    sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 25vw"
    style={imageCropStyle(crop ?? image)} />;
}

export function BlockImageGrid({ block, editorial = false }: { block: ProfileContentBlock; editorial?: boolean }) {
  const images = block.images ?? [];
  if (!images.length) return null;
  const config = normalizeImageGridConfig(block.config);
  return <div className={styles.frame}>
    <div className={styles.grid} data-columns={publicImageGridColumns(config.columns, images.length)}>
    {images.map((image) => <figure key={image.id} className={styles.figure}>
      <div className={styles.tile} style={{ aspectRatio: editorial ? editorialImageAspectRatio(config) : config.aspect_ratio }}><ProfileBlockImage image={image} /></div>
      {imageCaptionPresentation(image).caption && <figcaption className={styles.caption}>{imageCaptionPresentation(image).caption}</figcaption>}
    </figure>)}
    </div>
  </div>;
}

export function ProfileContentBlocks({ blocks }: { blocks: ProfileContentBlock[] }) {
  const visible = blocks.filter((block) => block.type === "video" ? Boolean(block.video) : block.type !== "image_grid" || block.images?.length);
  function renderBlock(block: ProfileContentBlock, paired: boolean, groupAlign?: TextAlignment) {
    const layout = normalizeBlockLayout(block.config);
    const align = block.type === "image_grid" ? undefined : normalizeTextBlockLayout(block.config).text_align;
    return <section className={`detail-section profile-content-block ${styles.editorialBlock}`} key={block.id}
      data-spacing-top={layout.spacing_top} data-spacing-bottom={layout.spacing_bottom}
      style={{ width: paired ? "100%" : `${layout.width_percent}%`, marginLeft: paired ? 0 : `${layout.offset_percent}%`, textAlign: groupAlign ?? align }}>
      {block.type === "heading" ? <h2>{block.content.text}</h2>
        : block.type === "text" ? <p>{block.content.text}</p> : block.type === "video" ? <>{block.content.title && <h3>{block.content.title}</h3>}{block.content.text && <p>{block.content.text}</p>}{block.video && <PortalVideo {...block.video} name={block.content.title || "Unternehmensvideo"}/>}</> : <BlockImageGrid block={block} />}
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
          image={[...row.left, ...row.right].filter((block) => block.type === "image_grid").map((block) => <BlockImageGrid key={block.id} block={block} editorial />)}
          textWidth={normalizeBlockLayout(text?.config).width_percent}
          imageWidth={normalizeBlockLayout([...row.left, ...row.right].find((block) => block.type === "image_grid")?.config).width_percent}
          imageFirst={row.left[0].type === "image_grid"} textAlign={frame.text_align} flow={frame.text_flow} />
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
    const section = <section key={item.key} className={`detail-section profile-content-block profile-editorial-section ${styles.editorialBlock}`}
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
      <TextImageSection text={section} image={<BlockImageGrid block={image} editorial />}
        textWidth={item.layout.width_percent} imageWidth={normalizeBlockLayout(image.config).width_percent}
        imageFirst={normalizeBlockLayout(image.config).offset_percent < item.layout.offset_percent} flow={frame.text_flow} />
    </div>);
  }
  flush();
  return <>{sections}</>;
}
