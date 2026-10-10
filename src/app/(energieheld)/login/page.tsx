import { AuthForm } from "@/components/auth/auth-form";
import { B2BPage } from "@/components/portal/b2b-page";
import styles from "@/components/portal/b2b.module.css";
export const metadata = { title: "Einloggen", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; passwort?: string }> }) {
  const { error, next, passwort } = await searchParams;
  return <B2BPage eyebrow="Ihr Zugang zu DAS Reiseportal" title="Redaktion / Login" description="Geschützter Zugang für die Redaktion. Für eine Angebotsanfrage benötigen Sie kein Konto.">
    <div className={styles.split}>
      <section className={styles.card}><h2>Persönlich beraten lassen</h2><p>Interessenten nutzen die unverbindliche Angebotsanfrage. Dieser Login ist für die interne Redaktion bestimmt.</p><p className={styles.note}>Ihre Zugangsdaten werden ausschließlich für die Anmeldung verwendet.</p></section>
      <div className={styles.card + " " + styles.authCard}><h2>Einloggen</h2>{passwort === "geaendert" && <p role="status">Passwort geändert. Bitte melden Sie sich erneut an.</p>}{error === "confirmation" && <p role="alert">Der Bestätigungslink ist ungültig oder abgelaufen. Wenn Ihre E-Mail-Adresse schon bestätigt ist, können Sie sich hier anmelden.</p>}<AuthForm mode="login" next={typeof next === "string" ? next : undefined} /></div>
    </div>
  </B2BPage>;
}
