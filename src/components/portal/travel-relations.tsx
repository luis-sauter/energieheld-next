import { publicTravelLabel } from "@/lib/travel-presentation";
import Link from "./navigation-link";
import { TravelQuicklinks } from "./travel-quicklinks";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";
import type { PublicTravelTerm } from "@/lib/reiseportal-filter-options";

export function TravelRelations({ title, links, facts = [], presentation, intro }: { title: string; links: BreadcrumbItem[]; facts?: PublicTravelTerm[]; presentation?: "profile"; intro?: string }) {
  if (presentation === "profile") return <section className="profile-discover" aria-label={title}>
    <header className="profile-discover-heading"><span className="eyebrow">Inspiration für Ihre Auszeit</span><h2>Hier beginnt Ihre nächste Reiseidee</h2><p>Diese Unterkunft hat Sie inspiriert? Entdecken Sie passende Themen und mehr aus der Region.</p></header>
    <TravelQuicklinks />
  </section>;
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
    <header><span className="eyebrow">Ihre nächste Reise entdecken</span><h2>{title}</h2><p>{intro ?? "Was diese Unterkunft ausmacht — und wohin es von hier aus weitergeht."}</p></header>
    <div className="travel-relations-grid">{groups.map(group => <section className="travel-relations-group" key={group.label} aria-label={group.label}>
      <h3>{group.label}</h3><p>{group.description}</p>
      <ul>{group.values.map(value => <li key={value.path || value.name}>{value.path ? <Link href={value.path}>{value.name}<span aria-hidden="true">↗</span></Link> : <span className="travel-relations-fact">{value.name}</span>}</li>)}</ul>
    </section>)}</div>
  </section>;
}
