import { OfferRequestCta } from "@/components/portal/offer-request-cta";
import Image from "next/image";
import { EditorialImageCard } from "@/components/portal/editorial-image-card";
import { DiscoveryAdvertising } from "@/components/advertising/discovery-advertising";
import { destinations } from "@/data/reiseportal-discovery";
import { loadDiscoveryAdvertising } from "@/lib/discovery-advertising";
import styles from "./reiseziele.module.css";
import { pageMetadata, hubDescriptions } from "@/lib/seo";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";
import { Breadcrumbs } from "@/components/portal/breadcrumbs";
import { JsonLd } from "@/components/portal/json-ld";
import { jsonLdGraph, breadcrumbSchema, collectionSchema } from "@/lib/seo-schema";

const breadcrumbs = portalBreadcrumbs("Reiseziele", "/reiseziele");

const imageRoot = "/reiseportal/redesign/reiseziele";
const countryAlts = ["See und bewaldete Berghänge in Deutschland", "Sommerliche See- und Berglandschaft in Österreich",
  "Schweizer Berglandschaft mit See", "Grüne Bergwiesen in Südtirol"];
// Short editorial teasers refer to regions with verified public portal content.
const countryTeasers = [
  "Von der Sächsischen Schweiz bis in die Berge.",
  "Bergurlaub rund um den Hochkönig und im Salzburger Land.",
  "Klare Seen und stille Natur – entdecken Sie den Blausee.",
  "Sonnige Bergwiesen rund um Meransen und Gitschberg Jochtal.",
];
const regions = [
  { title: "Sächsische Schweiz", text: "Deutschland", query: "Sächsische Schweiz", image: "saechsische-schweiz", alt: "Sandsteinfelsen über einem bewaldeten Tal" },
  { title: "Hochkönig", text: "Salzburger Land · Österreich", query: "Hochkönig", image: "hochkoenig", alt: "Grüne Alpenwiesen vor einem Kalksteinmassiv" },
  { title: "Blausee", text: "Schweiz", query: "Blausee", image: "blausee", alt: "Klarer türkisfarbener See in einem Nadelwald" },
  { title: "Gitschberg Jochtal", text: "Südtirol / Italien", query: "Gitschberg Jochtal", image: "gitschberg-jochtal", alt: "Südtiroler Almwiesen mit Bergblick" },
];

export const metadata = pageMetadata({ title: "Reiseziele – Länder und Regionen entdecken", description: hubDescriptions.destinations,
  path: "/reiseziele", image: "/reiseportal/destinations/oesterreich.jpg" });
export const dynamic = "force-dynamic";
export default async function DestinationsPage() {
  const advertising = await loadDiscoveryAdvertising("/reiseziele");
  return <main id="hauptinhalt" className={styles.page}>
    <JsonLd data={jsonLdGraph([breadcrumbSchema(breadcrumbs), collectionSchema({ name: "Reiseziele", description: hubDescriptions.destinations,
      path: "/reiseziele", items: destinations.map(entry => ({ name: entry.title, path: `/reiseziele/${entry.slug}` })) })])} />
    <section className={styles.hero} aria-labelledby="reiseziele-title">
      <Image className={styles.heroImage} src={`${imageRoot}/hero.webp`} alt="Blick über einen Alpensee mit zwei Wandernden am Aussichtspunkt"
        fill sizes="(max-width: 600px) 1440px, 100vw" preload />
      <div className={`${styles.heroContent} container`}>
        <Breadcrumbs items={breadcrumbs} className={styles.breadcrumbs} />
        <h1 id="reiseziele-title" className={styles.heading}>Reiseziele entdecken</h1>
        <p>Neue Lieblingsorte zwischen Seen, grünen Tälern und Bergen.
          Entdecken Sie Deutschland, Österreich, die Schweiz und Südtirol / Italien.</p>
      </div>
    </section>
    <div className="container">
      <section className={styles.countries} aria-labelledby="countries-title">
        <h2 id="countries-title" className={styles.sectionTitle}>Wohin zieht es Sie?</h2>
        <div className={styles.countryGrid}>
          {destinations.map((entry, index) => <EditorialImageCard key={entry.slug} title={entry.title}
            sizes="(max-width: 600px) calc(100vw - 48px), (max-width: 1000px) 45vw, 290px"
            text={countryTeasers[index]} href={`/reiseziele/${entry.slug}`} image={`${imageRoot}/${entry.slug}.webp`} alt={countryAlts[index]} />)}
        </div>
      </section>
      <div className={styles.advertising}>
        <DiscoveryAdvertising data={advertising} compact>{null}</DiscoveryAdvertising>
      </div>
      <section className={styles.regions} aria-labelledby="regions-title">
        <div className={styles.sectionHeading}>
          <h2 id="regions-title" className={styles.sectionTitle}>Beliebte Orte &amp; Regionen</h2>
          <p>Besondere Landschaften entdecken und passende Gastgeber im Reiseportal finden.</p>
        </div>
        <div className={styles.regionGrid}>
          {regions.map((region) => <EditorialImageCard key={region.image} compact title={region.title} text={region.text}
            href={`/suche?q=${encodeURIComponent(region.query)}`} image={`${imageRoot}/${region.image}.webp`} alt={region.alt} />)}
        </div>
      </section>
    </div>
    <OfferRequestCta />
  </main>;
}
