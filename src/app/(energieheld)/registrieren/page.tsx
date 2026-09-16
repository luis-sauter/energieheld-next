import { AuthForm } from "@/components/auth/auth-form";
import styles from "@/components/auth/auth.module.css";

export const metadata = {
  title: "Firma registrieren",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Für Unternehmen</p>
      <h1>Firma registrieren</h1>
      <p>
        Erstellen Sie Ihren Zugang zum Firmenbereich. Ihr Firmenprofil startet
        als Entwurf.
      </p>
      <div className={styles.card}>
        <AuthForm mode="register" />
      </div>
    </main>
  );
}
