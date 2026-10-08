import type { TravelTerm } from "@/lib/admin-travel-taxonomy";
import { audiencePresentation, publicTravelLabel } from "@/lib/travel-presentation";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";
import styles from "./auth.module.css";

export type OwnerTravelSelectionProps = { terms: TravelTerm[]; proposedKeys: string[]; approved: boolean };
export function OwnerTravelSelection({ terms, proposedKeys, approved, pending }: OwnerTravelSelectionProps & { pending: boolean }) {
  return <section aria-label="Ihre Reisevorschläge">
    <input type="hidden" name="travel_selection" value="1" />
    <h2>Ihre Reisevorschläge</h2>
    <p>Welche Reisebereiche passen zu Ihrer Unterkunft? Ihre Auswahl ist ein Vorschlag. Erst unsere Redaktion bestätigt die öffentlichen Reisezuordnungen.</p>
    {approved && <p>Bestehende bestätigte Reisezuordnungen bleiben erhalten. Neue Vorschläge ändern die öffentliche Zuordnung nicht automatisch.</p>}
    {([
      ["accommodation", "Unterkunftsart"],
      ["audience", "Für wen ist Ihre Unterkunft besonders geeignet?"],
      ["theme", "Welche Reisearten passen zu Ihrer Unterkunft?"],
    ] as const).map(([dimension, title]) => <fieldset key={dimension} className={styles.travelGroup} disabled={pending}>
      <legend>{title}</legend><div className={styles.travelOptions}>
        {terms.filter(term => term.dimension === dimension).map(term => {
          const slug = term.term_key.split(":")[1];
          const icon = dimension === "audience" ? audiencePresentation[slug]?.icon ?? slug : dimension === "accommodation" ? "unterkunft" : slug;
          return <label key={term.term_key} className={styles.travelOption}>
            <input type="checkbox" name="travel_terms" value={term.term_key} defaultChecked={proposedKeys.includes(term.term_key)} />
            <TravelThemeIcon slug={icon} /><span>{publicTravelLabel(term.term_key, term.label)}</span>
          </label>;
        })}
      </div>
    </fieldset>)}
  </section>;
}
