import { publicTravelLabel } from "@/lib/travel-presentation";
import Link from "next/link";
import { TravelThemeIcon } from "./travel-theme-icon";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";
import type { PublicTravelTerm } from "@/lib/reiseportal-filter-options";

export function TravelRelations({ title, links, facts = [], presentation }: { title: string; links: BreadcrumbItem[]; facts?: PublicTravelTerm[]; presentation?: "profile" }) {
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
  if (presentation === "profile") return <section className="profile-discover" aria-label={title}>
    <header className="profile-discover-heading"><span className="eyebrow">Inspiration für Ihre Auszeit</span><h2>Hier beginnt Ihre nächste Reiseidee</h2><p>Diese Unterkunft hat Sie inspiriert? Entdecken Sie passende Themen und mehr aus der Region.</p></header>
    <div className="profile-discover-facts">{groups.filter(group => !["Reisethemen", "Reiseziele", "Mehr entdecken"].includes(group.label)).map(group => <section key={group.label} aria-label={group.label}>
      <h3>{group.label}</h3><ul>{group.values.map(value => <li key={value.path || value.name}>{value.path ? <Link href={value.path}>{value.name}</Link> : <span>{value.name}</span>}</li>)}</ul>
    </section>)}</div>
    <div className="profile-discover-ideas">{groups.filter(group => ["Reisethemen", "Reiseziele", "Mehr entdecken"].includes(group.label)).map(group => <section key={group.label} data-kind={group.label === "Reiseziele" ? "destination" : "theme"} aria-label={group.label}>
      <header><h3>{group.label}</h3><p>{group.description}</p></header>
      <ul>{group.values.map(value => <li key={value.path}><Link href={value.path}>
        <span className="profile-discover-icon" aria-hidden="true">{group.label === "Reiseziele" ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg> : <TravelThemeIcon slug={value.path.split("/").at(-1) ?? ""} />}</span>
        <span><strong>{value.name}</strong><small>{group.label === "Reiseziele" ? "Region entdecken" : "Reiseideen entdecken"}</small></span><span className="profile-discover-arrow" aria-hidden="true">→</span>
      </Link></li>)}</ul>
    </section>)}</div>
  </section>;
  return <section className="travel-relations" aria-label={title}>
    <header><span className="eyebrow">Ihre nächste Reise entdecken</span><h2>{title}</h2><p>Was diese Unterkunft ausmacht — und wohin es von hier aus weitergeht.</p></header>
    <div className="travel-relations-grid">{groups.map(group => <section className="travel-relations-group" key={group.label} aria-label={group.label}>
      <h3>{group.label}</h3><p>{group.description}</p>
      <ul>{group.values.map(value => <li key={value.path || value.name}>{value.path ? <Link href={value.path}>{value.name}<span aria-hidden="true">↗</span></Link> : <span className="travel-relations-fact">{value.name}</span>}</li>)}</ul>
    </section>)}</div>
  </section>;
}
