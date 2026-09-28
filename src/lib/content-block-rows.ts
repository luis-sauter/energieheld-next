import type { ProfileContentBlock } from "./profile-content";
import { normalizeBlockLayout } from "./content-block-layout";

export type ContentRow = { left: ProfileContentBlock[]; right?: ProfileContentBlock[] };

// A heading and its following text share one column. An adjacent image block
// can occupy the remaining columns without introducing another content model.
export function contentBlockRows(blocks: ProfileContentBlock[]): ContentRow[] {
  const rows: ContentRow[] = [];
  for (let index = 0; index < blocks.length;) {
    const first = blocks[index];
    const text = first.type === "heading" && blocks[index + 1]?.type === "text" &&
      samePosition(first, blocks[index + 1]) ? [first, blocks[index + 1]] : [first];
    const next = blocks[index + text.length];
    const following = next?.type === "heading" && blocks[index + text.length + 1]?.type === "text" &&
      samePosition(next, blocks[index + text.length + 1]) ? [next, blocks[index + text.length + 1]] : next ? [next] : [];
    const firstIsImage = first.type === "image_grid";
    const nextIsImage = next?.type === "image_grid";
    if (next && firstIsImage !== nextIsImage && !overlap(first, next)) {
      const firstStart = normalizeBlockLayout(first.config).offset_percent;
      const nextStart = normalizeBlockLayout(next.config).offset_percent;
      rows.push(firstStart < nextStart ? { left: text, right: following } : { left: following, right: text });
      index += text.length + following.length;
    } else {
      rows.push({ left: text });
      index += text.length;
    }
  }
  return rows;
}

function samePosition(a: ProfileContentBlock, b: ProfileContentBlock) {
  const left = normalizeBlockLayout(a.config);
  const right = normalizeBlockLayout(b.config);
  return left.width_percent === right.width_percent && left.offset_percent === right.offset_percent;
}

function overlap(a: ProfileContentBlock, b: ProfileContentBlock) {
  const left = normalizeBlockLayout(a.config);
  const right = normalizeBlockLayout(b.config);
  return left.offset_percent < right.offset_percent + right.width_percent &&
    right.offset_percent < left.offset_percent + left.width_percent;
}

export function contentColumn(block: ProfileContentBlock) {
  const { offset_percent, width_percent } = normalizeBlockLayout(block.config);
  return `${Math.round(offset_percent) + 1} / span ${width_percent}`;
}
