import { AuthForm } from "@/components/auth/auth-form";
import { B2BPage } from "@/components/portal/b2b-page";
import styles from "@/components/portal/b2b.module.css";
export const metadata = { title: "Einloggen", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return <B2BPage eyebrow="Ihr Zugang zu DAS Reiseportal" title="Willkommen zurück" description="Melden Sie sich an, um Ihr Unterkunftsprofil, Ihre Anfragen oder den Adminbereich zu verwalten.">
    <div className={styles.split}>
      <section className={styles.card}><h2>Ein Portal. Ihr eigener Bereich.</h2><p>Pflegen Sie Ihre Unterkunft und behalten Sie Anfragen im Blick. Für die Redaktion steht der bestehende Adminbereich bereit.</p><p className={styles.note}>Ihre Zugangsdaten werden ausschließlich für die Anmeldung verwendet.</p></section>
      <div className={styles.card + " " + styles.authCard}><h2>Einloggen</h2>{error === "confirmation" && <p role="alert">Der Bestätigungslink ist ungültig oder abgelaufen. Wenn Ihre E-Mail-Adresse schon bestätigt ist, können Sie sich hier anmelden.</p>}<AuthForm mode="login" next={typeof next === "string" ? next : undefined} /></div>
    </div>
  </B2BPage>;
}
