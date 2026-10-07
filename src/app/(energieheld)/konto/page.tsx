import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalAccount } from "@/lib/portal-account-server";
import { B2BPage } from "@/components/portal/b2b-page";
import styles from "@/components/portal/b2b.module.css";
export const metadata = { title: "Mein Konto", robots: { index: false, follow: false } };
export default async function AccountPage() {
  const account = await getPortalAccount();
  if (account.access === "unauthenticated") redirect("/login");
  if (account.access === "admin") redirect("/admin");
  if (account.hasCompany) redirect("/firma");
  return <B2BPage eyebrow="Mein Konto" title="Ihr Zugang ist eingerichtet" description="Zu diesem Konto ist derzeit keine Firma zugeordnet."><section className={styles.card}><h2>So geht es weiter</h2><p>Wenn Sie bereits ein Firmenkonto eingerichtet haben, prüfen Sie bitte, ob Sie mit der richtigen E-Mail-Adresse angemeldet sind. Bei einer fehlenden Zuordnung wenden Sie sich an DAS Reiseportal.</p><div className={styles.actions}><Link className="button" href="/fuer-unternehmen">Informationen für Unternehmen</Link><Link className="button" href="/">Zum Reiseportal</Link></div></section></B2BPage>;
}
