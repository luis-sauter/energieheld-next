import { profileTravelSignals } from "@/lib/travel-presentation";
import { TravelThemeIcon } from "./travel-theme-icon";
import styles from "./travel-signals.module.css";

export function TravelSignals({ termKeys, limit = 4 }: { termKeys?: readonly string[]; limit?: number }) {
  const signals = profileTravelSignals(termKeys, limit);
  if (!signals.length) return null;
  return <ul className={styles.signals} aria-label="Reiseinteressen und Reisende">
    {signals.map(signal => <li key={signal.key} data-travel-term={signal.key}>
      <TravelThemeIcon slug={signal.icon} /><span>{signal.label}</span>
    </li>)}
  </ul>;
}
