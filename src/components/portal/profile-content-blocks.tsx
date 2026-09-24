import type { ProfileContentBlock } from "@/lib/profile-content";

export function ProfileContentBlocks({ blocks }: { blocks: ProfileContentBlock[] }) {
  return <>
    {blocks.map((block) => <section className="detail-section profile-content-block" key={block.id}>
      {block.type === "heading"
        ? <h2>{block.content.text}</h2>
        : <p>{block.content.text}</p>}
    </section>)}
  </>;
}
