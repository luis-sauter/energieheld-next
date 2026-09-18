import Link from "next/link";
import { adStatus } from "@/lib/ad-values";
import {
  clickThroughRate,
  type AnalyticsPeriod,
  type CompanyMetrics,
  type AdminMetrics,
  type TrafficMetrics,
} from "@/lib/dashboard-analytics";
import styles from "./dashboard.module.css";
const number = new Intl.NumberFormat("de-DE");
export function MetricCards({ items }: { items: [string, number | string][] }) {
  return (
    <dl className={styles.cards}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.card}>
          <dt>{label}</dt>
          <dd>{typeof value === "number" ? number.format(value) : value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PeriodPicker({
  period,
  base,
  view,
}: {
  period: AnalyticsPeriod;
  base: string;
  view?: string;
}) {
  return (
    <nav className={styles.nav} aria-label="Statistikzeitraum">
      {(
        [
          ["7", "7 Tage"],
          ["30", "30 Tage"],
          ["gesamt", "Gesamt"],
        ] as const
      ).map(([value, label]) => {
        const query = new URLSearchParams({ zeitraum: value });
        if (view) query.set("ansicht", view);
        return (
          <Link
            key={value}
            href={`${base}?${query}`}
            aria-current={value === period ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
export function TrafficCards({
  traffic,
  leads,
}: {
  traffic: TrafficMetrics;
  leads?: number;
}) {
  const items: [string, number][] = [
    ["Profilaufrufe", traffic.profile_views],
    ["Kontakt-Klicks", traffic.contact_clicks],
    ["Website-Klicks", traffic.website_clicks],
  ];
  if (leads !== undefined) items.push(["Erhaltene Kontaktanfragen", leads]);
  return (
    <>
      <MetricCards items={items} />
      {!traffic.has_data && (
        <p className={styles.hint}>
          Noch keine Daten zu Aufrufen und Klicks. Die Erfassung ist noch nicht
          aktiviert.
        </p>
      )}
    </>
  );
}
export function CompanyOverviewMetrics({ data }: { data: CompanyMetrics }) {
  return (
    <>
      <section className={styles.section}>
        <h2>Anfragen</h2>
        <MetricCards
          items={[
            ["Neue Anfragen", data.leads.new],
            ["Gesamte Anfragen", data.leads.total],
          ]}
        />
        <Link href="/firma/anfragen">Anfragen öffnen →</Link>
      </section>
      <section className={styles.section}>
        <h2>Werbung</h2>
        <MetricCards
          items={[
            ["Entwürfe", data.ads.draft],
            ["Zur Prüfung", data.ads.pending],
            ["Geplant", data.ads.scheduled],
            ["Aktiv", data.ads.active],
            ["Pausiert", data.ads.paused],
            ["Abgelaufen", data.ads.expired],
            ["Abgelehnt", data.ads.rejected],
          ]}
        />
        <Link href="/firma/werbung">Werbekampagnen öffnen →</Link>
      </section>
    </>
  );
}
export function CampaignStatistics({ data }: { data: CompanyMetrics }) {
  return (
    <section className={styles.section}>
      <h2>Werbekampagnen</h2>
      <p className={styles.hint}>
        Impressionen und Klicks im gewählten Zeitraum. Der Kampagnenstatus zeigt
        den aktuellen Stand. Die Klickrate ist Klicks geteilt durch
        Impressionen.
      </p>
      {!data.campaigns.length ? (
        <p>Noch keine Werbekampagnen vorhanden.</p>
      ) : (
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label="Statistiken der eigenen Werbekampagnen"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Kampagne</th>
                <th scope="col">Status</th>
                <th scope="col">Impressionen</th>
                <th scope="col">Klicks</th>
                <th scope="col">Klickrate</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/firma/werbung/${c.id}`}>
                      {c.internal_name || "Neue Werbekampagne"}
                    </Link>
                  </td>
                  <td>{adStatus(c, data.today)}</td>
                  <td>{number.format(c.impressions)}</td>
                  <td>{number.format(c.clicks)}</td>
                  <td>
                    {new Intl.NumberFormat("de-DE", {
                      maximumFractionDigits: 2,
                    }).format(clickThroughRate(c.impressions, c.clicks))}{" "}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.hint}>
        Die Erfassung von Werbe-Impressionen und Klicks ist noch nicht
        aktiviert.
      </p>
    </section>
  );
}
export function AdminOverviewMetrics({ data }: { data: AdminMetrics }) {
  return (
    <>
      <section className={styles.section}>
        <h2>Aktueller Überblick</h2>
        <MetricCards
          items={[
            ["Veröffentlichte Firmen", data.counts.published],
            ["Offene Erstfreischaltungen", data.counts.profiles_pending],
            ["Offene Verifizierungsanfragen", data.counts.quality_pending],
            ["Neue Leads", data.counts.leads_new],
            ["Offene Leads", data.counts.leads_open],
            ["Werbung zur Prüfung", data.counts.ads_pending],
            ["Aktive Werbekampagnen", data.counts.ads_active],
            ["Geplante Werbekampagnen", data.counts.ads_scheduled],
          ]}
        />
        <p className={styles.hint}>
          Offene Leads umfassen neue und gelesene Anfragen, die noch nicht
          erledigt sind. Diese Statuszahlen gelten unabhängig vom
          Statistikzeitraum.
        </p>
      </section>
      <section className={styles.section}>
        <h2>Analytics im gewählten Zeitraum</h2>
        <TrafficCards traffic={data.traffic} />
        <MetricCards
          items={[
            ["Werbe-Impressionen", data.advertising.impressions],
            ["Werbe-Klicks", data.advertising.clicks],
          ]}
        />
        {!data.advertising.has_data && (
          <p className={styles.hint}>
            Noch keine Werbe-Analytics. Die Erfassung ist noch nicht aktiviert.
          </p>
        )}
      </section>
    </>
  );
}
