import Link from "next/link";
import { companyPreparation, type OnboardingProfile } from "@/lib/company-onboarding";
import styles from "./company-onboarding.module.css";

const steps = [
  { title: "Stammdaten", text: "Ergänzen Sie zuerst die wichtigsten Angaben zu Ihrer Unterkunft.", label: "Profil bearbeiten", href: "/firma/profil" },
  { title: "Profil & Bilder", text: "Prüfen Sie danach die Darstellung und ergänzen Sie Ihre Bilder.", label: "Profil & Bilder gestalten", href: "/firma/profil/gestalten" },
  { title: "Freischaltung", text: "Wenn alles passt, reichen Sie Ihr Profil zur ersten Prüfung ein.", label: "Zur Freischaltung einreichen", href: "/firma/profil/gestalten#freischaltung" },
];
export function CompanyOnboarding({ profile, welcome }: { profile: OnboardingProfile & { slug?: string | null }; welcome?: boolean }) {
  const progress = companyPreparation(profile);
  if (profile.status === "approved") return <section className={styles.card}><h2>Profil veröffentlicht</h2><p>Ihre Unterkunft ist öffentlich im Reiseportal sichtbar.</p>{profile.slug && <Link className="button button-primary" href={`/unterkuenfte/${profile.slug}`}>Öffentliches Profil ansehen</Link>}</section>;
  if (profile.status === "pending") return <section className={styles.card}><h2>Ihr Profil wird geprüft</h2><p>Ihr Profil wurde zur Erstfreischaltung eingereicht. DAS Reiseportal prüft Ihre Angaben. Es ist noch nicht öffentlich.</p><Link className="button" href="/firma/profil/gestalten">Profil ansehen / weiter bearbeiten</Link></section>;
  const rejected = profile.status === "rejected";
  const next = rejected ? 0 : progress.next;
  return <section className={styles.card} aria-labelledby="onboarding-title">
    {welcome && <p className="eyebrow">Willkommen im Firmenbereich</p>}
    <h2 id="onboarding-title">{rejected ? "Änderungen erforderlich" : "Ihr Profil vorbereiten"}</h2>
    <p>Ihr Profil ist noch nicht öffentlich. Vervollständigen Sie zuerst Ihre Stammdaten, gestalten Sie anschließend Ihr Profil und reichen Sie es zur Freischaltung ein. Speichern und Bilder hochladen veröffentlicht es noch nicht.</p>
    <p>{progress.completed} von 3 Vorbereitungsschritten erledigt. Diese Orientierung ersetzt keine Prüfung durch die Redaktion.</p>
    <ol className={styles.steps}>
      {steps.map((step, index) => <li key={step.href} className={index === next ? styles.current : undefined} aria-current={index === next ? "step" : undefined}>
        <h3>{index + 1}. {step.title}</h3><p>{step.text}</p>
        <p className={styles.status}>{(index === 0 ? progress.basics : index === 1 ? progress.media : progress.submitted) ? "Vorbereitet" : index === next ? "Ihr nächster Schritt" : "Noch offen"}</p>
        <Link className={`button ${index === next ? "button-primary" : ""}`} href={step.href}>{rejected && index === 0 ? "Profil überarbeiten" : step.label}</Link>
      </li>)}
    </ol>
    <p>Spätere Text- und Medienänderungen benötigen nach der Erstfreigabe keine erneute Freigabe.</p>
  </section>;
}
