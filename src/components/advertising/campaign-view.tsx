"use client";

import { imageCropStyle } from "@/lib/image-crop";
import { bannerCropRatio } from "@/lib/banner-presentation";
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

function CreativeImage({ src, alt, width, height, mobile, crop }: { src: string; alt: string; width?: number; height?: number; mobile?: ActiveAd["mobile_image"]; crop?: ActiveAd["crop"] }) {
  // Signed uploads have unknown dimensions; the browser must use each image's intrinsic ratio.
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={crop ? styles.cropImage : undefined} style={crop ? imageCropStyle(crop) : undefined} />;
  return mobile ? <picture><source media="(max-width: 760px)" srcSet={mobile.imageUrl}
    width={mobile.width} height={mobile.height} />{image}</picture> : image;
}

export function CampaignSlot({
  placement,
  ad: initialAd,
  preview = false,
  showLabel = true,
  reordering = false,
  editorialPromo = false,
  searchResult = false,
}: {
  placement: AdPlacementId;
  ad?: ActiveAd;
  preview?: boolean;
  showLabel?: boolean;
  reordering?: boolean;
  editorialPromo?: boolean;
  searchResult?: boolean;
}) {
  const context = useInlineBanners();
  const inline = searchResult ? null : context;
  const ad = inline && !preview && !reordering && Object.hasOwn(inline.overrides, placement) ? inline.overrides[placement] ?? undefined : initialAd;
  if (!preview && !inline && ad?.suppressed) return null;
  const displayAd = !preview && (ad?.suppressed || !ad?.imageUrl) ? undefined : ad;
  const destination = adTargetUrl(displayAd?.target_url ?? "");
  const portalDestination = destination && new URL(destination).hostname === "das-reiseportal.com";
  const promo = editorialPromo && portalDestination && displayAd?.imageUrl && displayAd.body_text;
  // Portal-owned links stay on the current portal, including branch previews.
  const href = promo && destination
    ? new URL(destination).pathname + new URL(destination).search + new URL(destination).hash : destination ?? "#";
  const crop = displayAd?.crop;
  const content = displayAd && (
    displayAd.imageUrl ? (
      crop ? <span className={styles.cropFrame}
        style={crop && placement !== "top_banner" ? {aspectRatio:bannerCropRatio(displayAd.banner_size ?? "large",placement)} : undefined}>
      <CreativeImage
        key={displayAd.imageUrl}
        src={displayAd.imageUrl}
        alt={displayAd.headline}
        width={displayAd.image_width}
        height={displayAd.image_height}
        mobile={displayAd.mobile_image}
      />
      {/* The natural original reserves Premium geometry; crop applies only when explicitly saved. */}
      <CreativeImage src={displayAd.imageUrl} alt={displayAd.headline} mobile={displayAd.mobile_image} crop={crop} />
      </span> : <CreativeImage src={displayAd.imageUrl} alt={displayAd.headline}
        width={displayAd.image_width} height={displayAd.image_height} mobile={displayAd.mobile_image} />
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
      className={`${styles.slot} ${placement === "top_banner" ? styles.banner : ""} ${promo ? styles.editorialPromo : ""}`}
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
            className={`${styles.creative} ${displayAd.imageUrl ? styles.imageCreative : ""} ${!reordering && destination ? styles.interactiveCreative : ""}`}
            data-size={placement === "top_banner" ? undefined : displayAd.banner_size}
            href={href}
            rel="sponsored noopener noreferrer"
            target="_blank"
          >
            {content}
            {promo && <div className={styles.promoCopy}>
              <span className={styles.promoLabel}>Reiseinspiration</span>
              <strong>{displayAd.headline}</strong>
              <p>{displayAd.body_text}</p>
              <span className={styles.promoCta}>Jetzt entdecken <span aria-hidden="true">→</span></span>
            </div>}
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
          <h2>{c.internal_name || (admin ? "Neue Werbekampagne" : "Neue Angebotsanfrage")}</h2>
          <CampaignFacts campaign={c} />
          <CampaignSlot placement={c.placement} ad={c} preview />
          <Link
            className="button"
            href={`${admin ? "/admin" : "/firma"}/werbung/${c.id}`}
          >
            {admin
              ? c.archived_at ? "Archiv ansehen" : "Kampagne prüfen"
              : ["draft", "rejected"].includes(c.status)
                ? "Angebotsanfrage bearbeiten"
                : "Angebotsanfrage ansehen"}
          </Link>
        </article>
      ))}
    </div>
  );
}
