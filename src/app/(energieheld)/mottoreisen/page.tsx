import { OfferRequestCta } from "@/components/portal/offer-request-cta";
import Image from "next/image";
import { EditorialImageCard } from "@/components/portal/editorial-image-card";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";
import { MottoFilter } from "@/components/portal/motto-filter";
import { mottoGroup, mottoPresentation } from "@/lib/motto-presentation";
import { travelThemes } from "@/data/reiseportal-discovery";
import { DiscoveryAdvertising } from "@/components/advertising/discovery-advertising";
import { loadDiscoveryAdvertising } from "@/lib/discovery-advertising";
import destinationStyles from "../reiseziele/reiseziele.module.css";
import styles from "./mottoreisen.module.css";
import { pageMetadata, hubDescriptions, type SearchParameters } from "@/lib/seo";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";
import { Breadcrumbs } from "@/components/portal/breadcrumbs";
import { JsonLd } from "@/components/portal/json-ld";
import { jsonLdGraph, breadcrumbSchema, collectionSchema } from "@/lib/seo-schema";

const breadcrumbs = portalBreadcrumbs("Mottoreisen", "/mottoreisen");

const imageRoot = "/reiseportal/redesign/mottoreisen";
const inspirations = [
  { title: "Aktiv in der Natur", text: "Wandern, Radfahren & mehr", group: "aktiv", image: "wanderurlaub" },
  { title: "Einfach entspannen", text: "Wellness & Erholung", group: "erholung", image: "wellnessangebote" },
  { title: "Reisen mit der Familie", text: "Gemeinsame Erlebnisse", group: "familie", image: "familienurlaub" },
  { title: "Genuss & besondere Momente", text: "Zeit für Romantik zu zweit", group: "genuss", image: "romantik-zu-zweit" },
];
export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParameters> }) {
  const params = await searchParams;
  return pageMetadata({ title: "Mottoreisen – Reisen nach Ihrem Thema", description: hubDescriptions.themes, path: "/mottoreisen",
    image: "/reiseportal/mottoreisen-intro.jpg", noindex: Object.values(params ?? {}).some(Boolean) });
}
export const dynamic = "force-dynamic";
export default async function MottoTravelPage({ searchParams }: { searchParams?: Promise<{ gruppe?: string }> } = {}) {
  const [advertising, params] = await Promise.all([loadDiscoveryAdvertising("/mottoreisen"), searchParams ?? Promise.resolve({ gruppe: undefined })]);
  return <main id="hauptinhalt" className={`${destinationStyles.page} ${styles.page}`}>
    <JsonLd data={jsonLdGraph([breadcrumbSchema(breadcrumbs), collectionSchema({ name: "Mottoreisen", description: hubDescriptions.themes,
      path: "/mottoreisen", items: travelThemes.map(entry => ({ name: entry.title, path: `/mottoreisen/${entry.slug}` })) })])} />
    <section className={destinationStyles.hero} aria-labelledby="motto-heading">
      <Image className={destinationStyles.heroImage} src={`${imageRoot}/hero.webp`} alt="Zwei Reisende mit Blick über einen sonnigen Alpensee"
        fill sizes="(max-width: 600px) 1440px, 100vw" preload />
      <div className={`${destinationStyles.heroContent} container`}>
        <Breadcrumbs items={breadcrumbs} className={destinationStyles.breadcrumbs} />
        <h1 id="motto-heading" className={destinationStyles.heading}>Mottoreisen</h1>
        <p>Vielleicht geht es Ihnen aber gar nicht so sehr um ein bestimmtes Ziel, sondern Sie möchten eher einem speziellen Motto folgen? Auch damit kann DAS-Reiseportal.com dienen.</p>
        <p className={styles.introDetail}>Suchen Sie sich Ihr Traumziel unter den Golfreisen, den Wellnessangeboten, Geschäftsreisen oder unter den Reisen rund um das Wasser.</p>
      </div>
    </section>
    <div className="container">
      <section className={styles.themes} aria-labelledby="motto-grid-heading">
        <h2 id="motto-grid-heading" className={styles.visuallyHidden}>Reisen nach Ihrem Motto</h2>
        <MottoFilter initialGroup={mottoGroup(params.gruppe)}>
          <div className={styles.themeGrid}>
            {travelThemes.map(entry => <div key={entry.slug} data-groups={mottoPresentation[entry.slug].groups.join(" ")}>
              <EditorialImageCard compact title={entry.title} text="" href={`/mottoreisen/${entry.slug}`}
                icon={<TravelThemeIcon slug={entry.slug} />} image={`${imageRoot}/${entry.slug}.webp`} alt={mottoPresentation[entry.slug].alt} />
            </div>)}
          </div>
        </MottoFilter>
      </section>
      <div className={destinationStyles.advertising}>
        <DiscoveryAdvertising data={advertising} compact>{null}</DiscoveryAdvertising>
      </div>
      <section aria-labelledby="inspiration-heading">
        <div className={destinationStyles.sectionHeading}>
          <h2 id="inspiration-heading" className={destinationStyles.sectionTitle}>Beliebte Reisemotive</h2>
          <p>Lassen Sie sich von unseren vorhandenen Themen inspirieren.</p>
        </div>
        <div className={destinationStyles.regionGrid}>
          {inspirations.map(item => <EditorialImageCard key={item.group} compact title={item.title} text={item.text}
            href={`/mottoreisen?gruppe=${item.group}`} image={`${imageRoot}/${item.image}.webp`} alt={mottoPresentation[item.image].alt} />)}
        </div>
      </section>
    </div>
    <OfferRequestCta />
  </main>;
}
