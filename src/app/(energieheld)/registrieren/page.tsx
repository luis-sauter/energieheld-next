import { AuthForm } from "@/components/auth/auth-form";
import { B2BPage } from "@/components/portal/b2b-page";
import styles from "@/components/portal/b2b.module.css";
export const metadata = { title: "Firmenkonto erstellen", robots: { index: false, follow: false } };
export default function RegisterPage() {
  return <B2BPage eyebrow="Für Gastgeber und Reiseanbieter" title="Ihr Firmenkonto erstellen" description="Legen Sie Ihren Zugang an und bereiten Sie Ihr Unterkunftsprofil in Ruhe auf die Veröffentlichung vor.">
    <div className={styles.split}><section className={styles.card}><h2>Vom Zugang zum Profil</h2><ol className={styles.steps}><li>Erstellen Sie Ihr Konto und bestätigen Sie Ihre E-Mail-Adresse.</li><li>Ihre Firma wird dem Konto zugeordnet. Ihr Profil startet als Entwurf.</li><li>Vervollständigen Sie Angaben und Bilder vor der Veröffentlichung.</li><li>DAS Reiseportal prüft Ihr eingereichtes Profil und entscheidet über die Freigabe.</li></ol><p className={styles.note}>Die Registrierung garantiert keine Veröffentlichung. Preise und Bedingungen zusätzlicher Angebote werden separat geklärt.</p></section><div className={styles.card + " " + styles.authCard}><h2>Ihr Zugang</h2><AuthForm mode="register" /></div></div>
  </B2BPage>;
}
