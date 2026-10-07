import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/auth/password-form";
import { B2BPage } from "@/components/portal/b2b-page";
import { validRecoverySession } from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/portal/b2b.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Passwort zurücksetzen", robots: { index: false, follow: false } };
export default async function ResetPasswordPage() {
  let valid = false;
  try { valid = await validRecoverySession(await createClient()); } catch { /* Fail closed. */ }
  if (!valid) redirect("/passwort-vergessen?error=recovery");
  return <B2BPage eyebrow="Ihr Zugang" title="Neues Passwort festlegen" description="Nach dem Speichern melden Sie sich mit Ihrem neuen Passwort wieder an.">
    <div className={styles.card + " " + styles.authCard}><PasswordForm recovery /></div>
  </B2BPage>;
}
