import Image from "next/image";
import Link from "next/link";
import type { DiscoveryEntry } from "@/data/reiseportal-discovery";

export function DiscoveryCard({ entry, basePath }: { entry: DiscoveryEntry; basePath: string }) {
  return <Link className="discovery-card" href={`${basePath}/${entry.slug}`}>
    <span className="discovery-card-image"><Image src={entry.image} alt={entry.alt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" /></span>
    <span className="discovery-card-title">{entry.title}<span aria-hidden="true">→</span></span>
  </Link>;
}

export function ReiseOverview({ title, intro, entries, basePath }: {
  title: string;
  intro: string;
  entries: readonly DiscoveryEntry[];
  basePath: string;
}) {
  return <main id="hauptinhalt" className="container trade-page discovery-page">
    <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
      <Link href="/">Startseite</Link><span>›</span><span>{title}</span>
    </nav>
    <section className="section">
      <div className="section-heading"><div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div></div>
      <div className="discovery-grid">
        {entries.map((entry) => <DiscoveryCard key={entry.slug} entry={entry} basePath={basePath} />)}
      </div>
    </section>
  </main>;
}
