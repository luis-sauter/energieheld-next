import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { analyticsPeriod, loadCompanyMetrics } from "@/lib/dashboard-analytics";
import {
  PeriodPicker,
  TrafficCards,
  CampaignStatistics,
} from "@/components/dashboard/metrics";
import styles from "@/components/dashboard/dashboard.module.css";
import authStyles from "@/components/auth/auth.module.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Firmenstatistiken",
  robots: { index: false, follow: false },
};
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>;
}) {
  const period = analyticsPeriod((await searchParams).zeitraum);
  const result = await loadCompanyMetrics(await createClient(), period);
  if (result.unauthenticated) redirect("/login");
  return (
    <main
      id="hauptinhalt"
      className={`container ${authStyles.page} ${styles.page}`}
    >
      <Link href="/firma">← Zurück zum Firmenbereich</Link>
      <h1>Statistiken</h1>
      <PeriodPicker period={period} base="/firma/statistiken" />
      <p className={styles.hint}>
        7 und 30 Tage schließen den heutigen Tag ein. Alle Zeiträume gelten in
        Europe/Berlin.
      </p>
      {result.error && <p role="alert">{result.error}</p>}
      {result.data && (
        <>
          <section className={styles.section}>
            <h2>Ihr Firmenprofil</h2>
            <TrafficCards
              traffic={result.data.traffic}
              leads={result.data.leads.received}
            />
            <p className={styles.hint}>
              Kontaktanfragen werden direkt aus den tatsächlich eingegangenen
              Anfragen berechnet.
            </p>
          </section>
          <CampaignStatistics data={result.data} />
        </>
      )}
    </main>
  );
}
