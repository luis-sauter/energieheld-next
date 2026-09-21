import { AuthForm } from "@/components/auth/auth-form";
import styles from "@/components/auth/auth.module.css";

export const metadata = {
  title: "Einloggen",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Für Unternehmen</p>
      <h1>Einloggen</h1>
      <p>Melden Sie sich mit Ihrem Firmenkonto an.</p>
      <div className={styles.card}>
        {error === "confirmation" && (
          <p className={styles.error} role="alert">
            Der Bestätigungslink ist ungültig oder abgelaufen. Falls Sie Ihre
            E-Mail-Adresse bereits bestätigt haben, können Sie sich hier
            anmelden.
          </p>
        )}
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
