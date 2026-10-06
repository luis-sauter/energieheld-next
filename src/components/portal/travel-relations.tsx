import { publicTravelLabel } from "@/lib/travel-presentation";
import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";
import type { PublicTravelTerm } from "@/lib/reiseportal-filter-options";

export function TravelRelations({ title, links, facts = [] }: { title: string; links: BreadcrumbItem[]; facts?: PublicTravelTerm[] }) {
  if (!links.length && !facts.length) return null;
  return <section className="travel-relations" aria-label={title}>
    <h2>{title}</h2>
    {facts.length > 0 && <dl>{(["accommodation", "audience", "feature"] as const).map(dimension => {
      const values = facts.filter(term => term.dimension === dimension);
      return values.length ? <div key={dimension}>
        <dt>{{ accommodation: "Unterkunftstyp", audience: "Zielgruppe", feature: "Merkmale" }[dimension]}</dt>
        <dd>{values.map(term => publicTravelLabel(term.term_key, term.label)).join(", ")}</dd>
      </div> : null;
    })}</dl>}
    {links.length > 0 && <ul>{links.map(link => <li key={link.path}><Link href={link.path}>{link.name} →</Link></li>)}</ul>}
  </section>;
}
