import type { TravelTerm } from "./admin-travel-taxonomy";
import { audiencePresentation, publicTravelLabel } from "./travel-presentation";
import { isSeasonTerm } from "./travel-seasons";
import { isRetiredTravelTerm, SPECIAL_TOPIC_TERM } from "./travel-editorial";

export function travelTermVisibility(key: string, basic = false) {
  if (isRetiredTravelTerm(key)) return 'Historisch · öffentlich nicht aktiv';
  if (key === SPECIAL_TOPIC_TERM) return 'Wird auf der Startseite im Jahreszeiten- und Sonderthemenbereich angezeigt';
  if (isSeasonTerm(key)) return 'Saisonhinweis im Sonderthemenbereich · keine eigene Premium-Themenseite';
  if (key.startsWith('theme:')) return basic
    ? 'Öffentlicher Suchfilter · nicht auf Premium-Mottoseiten oder in deren Slidern'
    : 'Wird auf der passenden Premium-Mottoseite und als Suchfilter angezeigt';
  if (key.startsWith('audience:')) return audiencePresentation[key.split(':')[1]]
    ? 'Öffentlicher Suchfilter und Profilmerkmal · keine eigene Premium-Mottoseite'
    : 'Öffentlicher Suchfilter · keine eigene Premium-Mottoseite';
  if (key.startsWith('accommodation:')) return 'Öffentlicher Filter für die Unterkunftsart · keine eigene Premium-Mottoseite';
  return 'Nur intern · keine öffentliche Ausspielung';
}

export function travelTermIcon(term: TravelTerm) {
  const slug = term.term_key.split(":")[1];
  return term.dimension === "audience" ? audiencePresentation[slug]?.icon ?? "unterkunft" : term.dimension === "theme" ? slug : "unterkunft";
}
export function sameTravelKeys(a: readonly string[], b: readonly string[]) {
  const left = new Set(a), right = new Set(b);
  return left.size === right.size && [...left].every(key => right.has(key));
}
export function travelFilterPreview(terms: TravelTerm[], keys: readonly string[]) {
  const params = { theme: "thema", audience: "zielgruppe", accommodation: "unterkunftstyp" };
  return terms.filter(term => keys.includes(term.term_key)).map(term => {
    const parameter = term.dimension === "feature" || isSeasonTerm(term.term_key) || isRetiredTravelTerm(term.term_key) ? null : params[term.dimension];
    return { ...term, label: publicTravelLabel(term.term_key, term.label), href: parameter ? `/unterkuenfte-a-z?${new URLSearchParams({ [parameter]: term.term_key.split(":")[1] })}` : null };
  });
}
