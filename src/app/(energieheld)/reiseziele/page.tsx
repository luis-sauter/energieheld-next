import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/portal/icon";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";
import { destinations } from "@/data/reiseportal-discovery";
import { pageMetadata, hubDescriptions } from "@/lib/seo";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";
import { Breadcrumbs } from "@/components/portal/breadcrumbs";
import { JsonLd } from "@/components/portal/json-ld";
import { jsonLdGraph, breadcrumbSchema, collectionSchema } from "@/lib/seo-schema";
import styles from "./reiseziele.module.css";

const breadcrumbs = portalBreadcrumbs("Reiseziele", "/reiseziele");
const imageRoot = "/reiseportal/redesign/reiseziele";
const countryImages = ["deutschland-kueste", "oesterreich-salzburg-v3", "schweiz-skipiste-v3", "suedtirol-altstadt-v3"];
const countryAlts = ["Dünen, Strand und Leuchtturm an einer deutschen Küstenlandschaft", "Österreichische Altstadt mit Festung und Fluss",
  "Schweizer Skipiste vor verschneitem Alpenpanorama", "Südtiroler Altstadtgasse mit Laubengängen und Blumenschmuck"];
const countryTeasers = [
  "Von der Ostseeküste über Flusstäler bis an den Alpenrand.",
  "Alpentäler, Seen und Städte voller Geschichte.",
  "Bergdörfer, klare Seen und Wege mit weitem Blick.",
  "Dolomiten, Weinberge und die Seen Norditaliens.",
];
const inspirations = [
  { title: "Wellness", theme: "wellnessangebote", text: "Entspannen, genießen und neue Energie tanken.", alt: "Entspannung im Pool mit Blick auf See und Berge" },
  { title: "Familie", theme: "familienurlaub", text: "Gemeinsam unvergessliche Momente erleben.", alt: "Familie am sonnigen Seeufer" },
  { title: "Aktiv", theme: "wanderurlaub", text: "Wandern, neue Wege finden und die Natur entdecken.", alt: "Wandernde auf einem Bergweg über dem See" },
  { title: "Genuss & Natur", theme: "natur-pur", text: "Zur Ruhe kommen und besondere Landschaften genießen.", alt: "Regionale Genussmomente auf einer Terrasse mit Weinbergen und Seeblick" },
];
const quicklinks = [
  { title: "Wellnessurlaub", icon: "wellnessangebote", href: "/mottoreisen/wellnessangebote" },
  { title: "Wandern", icon: "wanderurlaub", href: "/mottoreisen/wanderurlaub" },
  { title: "Radwandern", icon: "radwandern", href: "/mottoreisen/radwandern" },
  { title: "Skiurlaub", icon: "skifahren", href: "/mottoreisen/skifahren" },
  { title: "Mit Hund", icon: "mit-hund", href: "/unterkuenfte-a-z?zielgruppe=mit-hund" },
  { title: "Familienzeit", icon: "familienurlaub", href: "/mottoreisen/familienurlaub" },
];
const benefits = [
  { title: "Ausgewählte Reiseideen", icon: "globe", text: "Inspiration für Deutschland, Österreich, die Schweiz und Südtirol / Italien – übersichtlich zusammengestellt." },
  { title: "Passende Gastgeber", icon: "home", text: "Von familiär geführten Hotels bis zu besonderen Unterkünften: Finden Sie Gastgeber für Ihre Auszeit." },
  { title: "Direkte Anfrage", icon: "mail", text: "Bei Gastgebern mit Unternehmensprofil einfach und direkt anfragen – ohne Umwege." },
];
const countryTitle = (slug: string, title: string) => slug === "suedtirol-italien" ? "Südtirol / Italien" : title;
function Arrow() { return <span className={styles.arrow} aria-hidden="true"><Icon name="arrow" /></span>; }

export const metadata = pageMetadata({ title: "Reiseziele – Vier Länder. Viele Möglichkeiten.", description: hubDescriptions.destinations,
  path: "/reiseziele", image: `${imageRoot}/hero-flusstal-v3.webp` });
export const dynamic = "force-dynamic";
export default function DestinationsPage() {
  return <main id="hauptinhalt" className={styles.page}>
    <div className={styles.backdrop} aria-hidden="true"><Image src={`${imageRoot}/hero-flusstal-v3.webp`} alt="" fill sizes="100vw" preload /></div>
    <JsonLd data={jsonLdGraph([breadcrumbSchema(breadcrumbs), collectionSchema({ name: "Reiseziele", description: hubDescriptions.destinations,
      path: "/reiseziele", items: destinations.map(entry => ({ name: entry.title, path: `/reiseziele/${entry.slug}` })) })])} />
    <section className={styles.hero} aria-labelledby="reiseziele-title">
      <div className={`${styles.heroContent} container`}>
        <Breadcrumbs items={breadcrumbs} className={styles.breadcrumbs} />
        <h1 id="reiseziele-title" className={styles.heading}>Vier Länder.<br />Viele Möglichkeiten.</h1>
        <p>Entdecken Sie Deutschland, Österreich, die Schweiz und Südtirol / Italien – vier einzigartige Regionen mit atemberaubender Natur, faszinierenden Kulturen und unvergesslichen Erlebnissen.</p>
      </div>
    </section>
    <div className="container">
      <section className={styles.countries} aria-labelledby="countries-title">
        <h2 id="countries-title" className={styles.srOnly}>Unsere vier Reiseziele</h2>
        <div className={styles.countryGrid}>
          {destinations.map((entry, index) => <Link className={styles.countryCard} key={entry.slug} href={`/reiseziele/${entry.slug}`}>
            <div className={styles.countryPhoto}><Image src={`${imageRoot}/${countryImages[index]}.webp`} alt={countryAlts[index]} fill
              sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1336px) 45vw, 606px" /></div>
            <div className={styles.countryBody}><div><h3>{countryTitle(entry.slug, entry.title)}</h3><p>{countryTeasers[index]}</p></div>
              <span className={styles.discover}>Entdecken <Arrow /></span></div>
          </Link>)}
        </div>
      </section>
    </div>
    <div className={styles.inspirationArea}>
      <div className="container">
        <section className={styles.inspiration} aria-labelledby="inspiration-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Urlaub nach Ihren Wünschen</p>
            <h2 id="inspiration-title">Reiseinspiration nach Art des Urlaubs</h2>
            <p>Ob Entspannung, gemeinsame Zeit oder aktive Erlebnisse – finden Sie Ihren ganz persönlichen Urlaub in Deutschland, Österreich, der Schweiz oder Südtirol / Italien.</p></div>
          <div className={styles.inspirationGrid}>
            {inspirations.map(item => <article className={styles.inspirationCard} key={item.theme}>
              <Link className={styles.themeLink} href={`/mottoreisen/${item.theme}`}>
                <div className={styles.themePhoto}><Image src={item.theme === "natur-pur" ? `${imageRoot}/genuss-natur.webp` : `/reiseportal/redesign/mottoreisen/${item.theme}.webp`} alt={item.alt} fill
                  sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) 45vw, 295px" /></div>
                <div className={styles.themeBody}><div><h3>{item.title}</h3><p>{item.text}</p></div><Arrow /></div>
              </Link>
              <ul className={styles.countryPills} aria-label={`${item.title} nach Reiseziel`}>
                {destinations.map(country => <li key={country.slug}><Link href={`/unterkuenfte-a-z?ziel=${country.slug}&thema=${item.theme}`}
                  aria-label={`${item.title} in ${countryTitle(country.slug, country.title)}`}>{countryTitle(country.slug, country.title)}</Link></li>)}
              </ul>
            </article>)}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="quicklinks-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Beliebte Einstiege</p>
            <h2 id="quicklinks-title">So finden Sie schneller das passende Reiseziel</h2>
            <p>Lassen Sie sich von beliebten Urlaubsthemen inspirieren und entdecken Sie passende Gastgeber in allen vier Ländern.</p></div>
          <div className={styles.quicklinks}>{quicklinks.map(item => <Link className={styles.quicklink} key={item.title} href={item.href}>
            <span className={styles.orangeIcon}><TravelThemeIcon slug={item.icon} /></span>
            <span>{item.title}</span><Arrow /></Link>)}</div>
        </section>
        <section className={styles.section} aria-labelledby="benefits-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Gut zu wissen</p><h2 id="benefits-title">Warum DAS-Reiseportal.com?</h2></div>
          <div className={styles.benefits}>{benefits.map(item => <article className={styles.benefit} key={item.title}>
            <span className={styles.orangeIcon}><Icon name={item.icon} size={38} /></span><div><h3>{item.title}</h3><p>{item.text}</p></div>
          </article>)}</div>
        </section>
        <section className={styles.partner} aria-labelledby="partner-title">
          <Image src={`${imageRoot}/partner-chalet.webp`} alt="" fill sizes="(max-width: 1336px) 100vw, 1240px" />
          <div className={styles.partnerContent}><p className={styles.eyebrow}>Partner werden</p><h2 id="partner-title">Ihr Unternehmen auf DAS-Reiseportal.com</h2>
            <p>Erreichen Sie neue Gäste und präsentieren Sie Ihre Unterkunft oder Ihr Angebot für Deutschland, Österreich, die Schweiz und Südtirol / Italien.</p>
            <Link className="button button-primary" href="/angebot-anfragen">Angebot anfragen <Icon name="arrow" /></Link></div>
        </section>
      </div>
    </div>
  </main>;
}
