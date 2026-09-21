import type { CSSProperties } from "react";
import Link from "next/link";
import { reiseportal } from "@/config/reiseportal";
import { energieheld } from "@/config/energieheld";
import { listings, travelListing } from "@/data/listings";
import { mockAds } from "@/data/ads";
import { PortalHeader, PortalFooter } from "@/components/portal/chrome";
import { ListingCard } from "@/components/portal/listings";
import { ListingDetail } from "@/components/portal/listing-detail";
import { AdSlot } from "@/components/portal/ads";

export const metadata = {
  title: { absolute: "Portal-Komponenten · Technische Vorschau" },
  robots: { index: false, follow: false },
};
export default function PortalPreview() {
  const style = {
    "--brand-primary": reiseportal.colors.primary,
    "--brand-accent": reiseportal.colors.accent,
    "--brand-surface": reiseportal.colors.surface,
  } as CSSProperties;
  return (
    <div style={style}>
      <PortalHeader brand={reiseportal} />
      <main id="hauptinhalt" className="container section">
        <div className="preview-intro" id="reiseziele">
          <p className="eyebrow">
            Technische Vorschau · Gemeinsame Komponenten
          </p>
          <h1>Ein Kern. Zwei Perspektiven.</h1>
          <p>
            Dieselben Listing-Komponenten für Fachbetriebe und Gastgeber. Die
            Anzeigen sind eigene Werbeplätze und gehören nicht zu den
            organischen Ergebnissen.
          </p>
        </div>
        <AdSlot placement="destination_top" ad={mockAds[0]} />
        <div className="ad-layout">
          <section id="unterkuenfte">
            <h2>Zwei Marken, dieselbe ListingCard</h2>
            <div className="listing-grid comparison-grid">
              <ListingCard
                listing={listings[0]}
                categories={energieheld.categories}
                href="/experten/mueller-haustechnik"
              />
              <ListingCard
                listing={travelListing}
                categories={reiseportal.categories}
                href="#hotelprofil"
              />
            </div>
            <div className="notice" id="werbehinweis">
              <div>
                <h2>Werbung bleibt Werbung.</h2>
                <p>
                  Alle vier Motive sind Demobanner. Sie bewerben keine buchbaren
                  Reisen. Auf Desktop liegt ein Banner über dem Inhalt; drei
                  weitere stehen rechts. Auf kleinen Displays folgen sie als
                  breite Flächen unter den Listings.
                </p>
              </div>
            </div>
          </section>
          <aside className="ad-sidebar" aria-label="Werbeplätze">
            {mockAds.slice(1).map((ad) => (
              <AdSlot key={ad.id} placement={ad.placement} ad={ad} />
            ))}
          </aside>
        </div>
        <section id="hotelprofil" className="travel-detail">
          <p className="eyebrow">Auch das Detailprofil ist wiederverwendbar</p>
          <ListingDetail
            headingLevel={2}
            listing={travelListing}
            categories={reiseportal.categories}
          />
        </section>
        <Link className="text-link back-link" href="/">
          ← Zur Energieheld-Startseite
        </Link>
      </main>
      <PortalFooter brand={reiseportal} />
    </div>
  );
}
