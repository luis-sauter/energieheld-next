import { PasswordForm } from "@/components/auth/password-form";
import { B2BPage } from "@/components/portal/b2b-page";
import { recoveryLinkError } from "@/lib/auth-recovery";
import styles from "@/components/portal/b2b.module.css";
export const metadata = { title: "Passwort vergessen", robots: { index: false, follow: false } };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <B2BPage eyebrow="Ihr Zugang" title="Passwort vergessen?" description="Fordern Sie einen Link an, um ein neues Passwort für Ihr Konto festzulegen.">
    <div className={styles.card + " " + styles.authCard}>
      {error === "recovery" && <p role="alert">{recoveryLinkError}</p>}
      <PasswordForm />
    </div>
  </B2BPage>;
}
