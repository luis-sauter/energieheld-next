import { publicTravelLabel } from "@/lib/travel-presentation";
import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";
import type { PublicTravelTerm } from "@/lib/reiseportal-filter-options";

export function TravelRelations({ title, links, facts = [] }: { title: string; links: BreadcrumbItem[]; facts?: PublicTravelTerm[] }) {
  const uniqueLinks = [...new Map(links.map(link => [link.path, link])).values()];
  const uniqueFacts = [...new Map(facts.map(term => [term.term_key, term])).values()];
  const groups = [
    { label: "Unterkunftsart", description: "So wohnen Sie hier", values: uniqueFacts.filter(term => term.dimension === "accommodation").map(term => ({ name: publicTravelLabel(term.term_key, term.label), path: "/unterkuenfte-a-z?unterkunftstyp=" + encodeURIComponent(term.slug) })) },
    { label: "Für wen passt die Unterkunft?", description: "Gemeinsam die passende Auszeit finden", values: uniqueFacts.filter(term => term.dimension === "audience").map(term => ({ name: publicTravelLabel(term.term_key, term.label), path: "/unterkuenfte-a-z?zielgruppe=" + encodeURIComponent(term.slug) })) },
    { label: "Reisethemen", description: "Entdecken Sie mehr zu Ihren Interessen", values: uniqueLinks.filter(link => link.path.startsWith("/mottoreisen/")) },
    { label: "Reiseziele", description: "Die Region und weitere Gastgeber entdecken", values: uniqueLinks.filter(link => link.path.startsWith("/reiseziele/")) },
    { label: "Gut zu wissen", description: "Weitere Merkmale dieser Unterkunft", values: uniqueFacts.filter(term => term.dimension === "feature").map(term => ({ name: publicTravelLabel(term.term_key, term.label), path: "" })) },
    { label: "Mehr entdecken", description: "Passende Angebote im Reiseportal", values: uniqueLinks.filter(link => !link.path.startsWith("/reiseziele/") && !link.path.startsWith("/mottoreisen/")) },
  ].filter(group => group.values.length);
  if (!groups.length) return null;
  return <section className="travel-relations" aria-label={title}>
    <header><span className="eyebrow">Ihre nächste Reise entdecken</span><h2>{title}</h2><p>Was diese Unterkunft ausmacht — und wohin es von hier aus weitergeht.</p></header>
    <div className="travel-relations-grid">{groups.map(group => <section className="travel-relations-group" key={group.label} aria-label={group.label}>
      <h3>{group.label}</h3><p>{group.description}</p>
      <ul>{group.values.map(value => <li key={value.path || value.name}>{value.path ? <Link href={value.path}>{value.name}<span aria-hidden="true">↗</span></Link> : <span className="travel-relations-fact">{value.name}</span>}</li>)}</ul>
    </section>)}</div>
  </section>;
}
