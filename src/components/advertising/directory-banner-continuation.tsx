"use client";
import { useEffect, useRef, useState } from "react";
import type { ActiveAd } from "@/lib/ad-values";
import { directoryBannerSequence } from "@/lib/directory-banner-layout";
import { CampaignSlot } from "./campaign-view";

// Repeat only presentation. CampaignSlot has no impression-write side effect;
// searchResult also avoids duplicate slot IDs and booking/editor controls.
export function DirectoryBannerContinuation({ pool, previousId }: { pool: ActiveAd[]; previousId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const averageHeight = useRef(136);
  const [count, setCount] = useState(pool.length);
  const key = pool.map(ad => ad.id).join("|");
  useEffect(() => {
    const root = ref.current, content = root?.closest(".commercial-columns")?.querySelector(".commercial-content");
    if (!root || !content || !pool.length) return;
    const measure = () => {
      if (window.innerWidth <= 900) return;
      const cards = Array.from(root.children).slice(0, pool.length);
      const cycleHeight = cards.reduce((sum, card) => sum + (card.getBoundingClientRect().height > 1 ? card.getBoundingClientRect().height : 120) + 16, 0);
      if (cards.length) averageHeight.current = cycleHeight / cards.length;
      const remaining = content.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
      const next = Math.ceil(Math.max(0, remaining) / averageHeight.current);
      setCount(current => current === next ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content); observer.observe(root);
    measure();
    return () => observer.disconnect();
  }, [key, pool]);
  return <div ref={ref} className="directory-banner-continuation" data-directory-banner-continuation>
    {directoryBannerSequence(pool,count,previousId).map((ad,index) => <CampaignSlot key={`${ad.id}-${index}`} ad={ad} placement={ad.placement} searchResult showLabel={false} />)}
  </div>;
}
