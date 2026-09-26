import Image from "next/image";
import Link from "next/link";
import { DiscoveryCard } from "@/components/portal/reise-overview";
import { travelThemes } from "@/data/reiseportal-discovery";

export const metadata = { title: "Mottoreisen" };
export default function MottoTravelPage() {
  return <main id="hauptinhalt" className="container trade-page discovery-page motto-page">
    <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
      <Link href="/">Startseite</Link><span>›</span><span>Mottoreisen</span>
    </nav>
    <section className="motto-intro" aria-labelledby="motto-heading">
      <div>
        <p className="eyebrow">Reisen nach Interesse</p>
        <h1 id="motto-heading">Mottoreisen</h1>
        <p>Vielleicht geht es Ihnen aber gar nicht so sehr um ein bestimmtes Ziel, sondern Sie möchten eher einem speziellen Motto folgen? Auch damit kann DAS-Reiseportal.com dienen.</p>
        <p>Suchen Sie sich Ihr Traumziel unter den Golfreisen, den Wellnessangeboten, Geschäftsreisen oder unter den Reisen rund um das Wasser.</p>
      </div>
      <div className="motto-intro-image"><Image src="/reiseportal/mottoreisen-intro.jpg" alt="Originales Mottoreisen-Motiv aus dem Reiseportal" fill sizes="(max-width: 700px) 100vw, 50vw" priority /></div>
    </section>
    <section className="section" aria-labelledby="motto-grid-heading">
      <div className="section-heading"><div><h2 id="motto-grid-heading">Reisen nach Ihrem Motto</h2></div></div>
      <div className="discovery-grid">{travelThemes.map((entry) =>
        <DiscoveryCard key={entry.slug} entry={entry} basePath="/mottoreisen" />)}</div>
    </section>
  </main>;
}
