"use client";

import Link from "next/link";
import { useInlineBanners } from "./inline-banner-context";
import {
  adPlacements,
  adScopeLabel,
  adStatus,
  adTargetUrl,
  type ActiveAd,
  type AdCampaign,
  type AdPlacementId,
} from "@/lib/ad-values";
import styles from "./advertising.module.css";
import { energieheld } from "@/config/energieheld";

function CreativeImage({ src, alt, width, height, mobile }: { src: string; alt: string; width?: number; height?: number; mobile?: ActiveAd["mobile_image"] }) {
  // Signed uploads have unknown dimensions; the browser must use each image's intrinsic ratio.
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />;
  return mobile ? <picture><source media="(max-width: 760px)" srcSet={mobile.imageUrl}
    width={mobile.width} height={mobile.height} />{image}</picture> : image;
}

export function CampaignSlot({
  placement,
  ad: initialAd,
  preview = false,
  showLabel = true,
  reordering = false,
}: {
  placement: AdPlacementId;
  ad?: ActiveAd;
  preview?: boolean;
  showLabel?: boolean;
  reordering?: boolean;
}) {
  const inline = useInlineBanners();
  const ad = inline && !preview && !reordering && Object.hasOwn(inline.overrides, placement) ? inline.overrides[placement] ?? undefined : initialAd;
  if (!preview && !inline && ad?.suppressed) return null;
  const displayAd = !preview && (ad?.suppressed || !ad?.imageUrl) ? undefined : ad;
  const content = displayAd && (
    displayAd.imageUrl ? (
      <CreativeImage
        key={displayAd.imageUrl}
        src={displayAd.imageUrl}
        alt={displayAd.headline}
        width={displayAd.image_width}
        height={displayAd.image_height}
        mobile={displayAd.mobile_image}
      />
    ) : (
      <div>
        <strong>{displayAd.headline || "Ihre Überschrift"}</strong>
        {displayAd.body_text && <p>{displayAd.body_text}</p>}
        <span>Mehr erfahren →</span>
      </div>
    )
  );
  return (
    <section
      className={`${styles.slot} ${placement === "top_banner" ? styles.banner : ""}`}
      data-placement={placement}
      aria-label={`Anzeige – ${adPlacements[placement]}`}
    >
      {showLabel && <div className={styles.label}>Anzeige{preview ? " · Vorschau" : ""}</div>}
      {inline && !preview && !reordering && <div className={styles.inlineControls}>
        <strong>{adPlacements[placement]}</strong>
        <button type="button" className="button" onClick={() => inline.open(placement, ad?.id)}>
          {ad?.imageUrl || inline.hasBanner?.(placement) ? "Banner bearbeiten" : "Banner hinzufügen"}
        </button>
      </div>}
      {displayAd ? (
        preview ? (
          <div className={`${styles.creative} ${displayAd.imageUrl ? styles.imageCreative : ""}`}
            data-size={placement === "top_banner" ? undefined : displayAd.banner_size}>{content}</div>
        ) : (
          <a
            className={`${styles.creative} ${displayAd.imageUrl ? styles.imageCreative : ""}`}
            data-size={placement === "top_banner" ? undefined : displayAd.banner_size}
            href={adTargetUrl(displayAd.target_url) ?? "#"}
            rel="sponsored noopener noreferrer"
            target="_blank"
          >
            {content}
          </a>
        )
      ) : (
        <div className={styles.empty}>
          <span>Freier Werbeplatz</span>
          <strong>Hier wird Ihr Unternehmen sichtbar.</strong>
          <p>Im passenden Umfeld. Nah an Ihren Kunden.</p>
          <Link className="text-link" href="/werbung">
            Werbemöglichkeiten entdecken →
          </Link>
        </div>
      )}
    </section>
  );
}
export function CampaignFacts({ campaign: c }: { campaign: AdCampaign }) {
  return (
    <>
      <span className={styles.status}>{adStatus(c)}</span>
      <dl className={styles.details}>
        <dt>Seite und Werbeplatz</dt>
        <dd>{adScopeLabel(c)}</dd>
        <dt>Gewünschter Zeitraum</dt>
        <dd>
          {c.requested_start_date} bis {c.requested_end_date}
        </dd>
        {c.approved_start_date && (
          <>
            <dt>Bestätigter Zeitraum</dt>
            <dd>
              {c.approved_start_date} bis {c.approved_end_date}
            </dd>
          </>
        )}
      </dl>
      {!!c.unavailableTargets?.length && (
        <p className={styles.note}>
          Diese Zielgewerke sind der Firma aktuell nicht zugeordnet und werden
          dort nicht ausgespielt:{" "}
          {c.unavailableTargets
            .map(
              (id) =>
                energieheld.categories.find((category) => category.id === id)
                  ?.name ?? id,
            )
            .join(" · ")}
          . Eine Freigabe oder Reaktivierung ist erst nach Korrektur der Auswahl
          oder Klärung der offiziellen Zuordnung möglich.
        </p>
      )}
      {c.admin_note && (
        <p className={styles.note}>Hinweis von Energieheld: {c.admin_note}</p>
      )}
    </>
  );
}
export function CampaignList({
  campaigns,
  admin = false,
}: {
  campaigns: AdCampaign[];
  admin?: boolean;
}) {
  return (
    <div className={styles.grid}>
      {campaigns.map((c) => (
        <article className={styles.card} key={c.id}>
          {admin && <p className="eyebrow">{c.companyName}</p>}
          <h2>{c.internal_name || "Neue Werbekampagne"}</h2>
          <CampaignFacts campaign={c} />
          <CampaignSlot placement={c.placement} ad={c} preview />
          <Link
            className="button"
            href={`${admin ? "/admin" : "/firma"}/werbung/${c.id}`}
          >
            {admin
              ? "Kampagne prüfen"
              : ["draft", "rejected"].includes(c.status)
                ? "Kampagne bearbeiten"
                : "Kampagne ansehen"}
          </Link>
        </article>
      ))}
    </div>
  );
}
