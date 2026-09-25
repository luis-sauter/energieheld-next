import Link from "next/link";
import Image from "next/image";
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
export function CampaignSlot({
  placement,
  ad,
  preview = false,
}: {
  placement: AdPlacementId;
  ad?: ActiveAd;
  preview?: boolean;
}) {
  const content = ad && (
    ad.imageUrl ? (
      <Image
        src={ad.imageUrl}
        alt={ad.headline}
        width={1200}
        height={600}
        unoptimized
      />
    ) : (
      <div>
        <strong>{ad.headline || "Ihre Überschrift"}</strong>
        {ad.body_text && <p>{ad.body_text}</p>}
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
      <div className={styles.label}>Anzeige{preview ? " · Vorschau" : ""}</div>
      {ad ? (
        preview ? (
          <div className={`${styles.creative} ${ad.imageUrl ? styles.imageCreative : ""}`}>{content}</div>
        ) : (
          <a
            className={`${styles.creative} ${ad.imageUrl ? styles.imageCreative : ""}`}
            href={adTargetUrl(ad.target_url) ?? "#"}
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
        <dt>Werbeplatz</dt>
        <dd>{adPlacements[c.placement]}</dd>
        <dt>Ausspielung</dt>
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
