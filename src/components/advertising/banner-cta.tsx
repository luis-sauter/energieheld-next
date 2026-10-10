"use client";
import type { AdPlacementId } from "@/lib/ad-values";
import { bannerOfferHref } from "@/lib/banner-offer-link";
import styles from "./advertising.module.css";
export function BannerCta({ placement }: { placement: AdPlacementId }) {
  // Enrich the ordinary link at interaction time; no route hooks or hydration state.
  const locate = (event: { currentTarget: HTMLAnchorElement }) => {
    event.currentTarget.href = bannerOfferHref(placement, window.location.pathname);
  };
  return <a className={styles.bannerInquiry} href={bannerOfferHref(placement)}
    onFocus={locate} onPointerDown={locate} onClick={locate} onAuxClick={locate}
    aria-label={"Angebot für diesen Werbeplatz anfragen"}>Angebot anfragen →</a>;
}
