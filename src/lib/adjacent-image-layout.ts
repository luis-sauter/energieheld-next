export type ImageSide = "left" | "right";
export type ImageShare = 25 | 50 | 75;

export function adjacentImageLayout(side: unknown, share: unknown) {
  if (side !== "left" && side !== "right" || share !== 25 && share !== 50 && share !== 75) return null;
  const textWidth = 100 - share;
  return {
    side, imageWidth: share, textWidth,
    imageOffset: side === "left" ? 0 : textWidth,
    textOffset: side === "left" ? share : 0,
  };
}
