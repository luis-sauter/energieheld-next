import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadReviewOverview } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission, legalName } from "@/lib/admin";
import styles from "@/components/admin/admin.module.css";

export const metadata = {
  title: "Adminbereich",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string }>;
}) {
  const published = (await searchParams).ansicht === "veroeffentlicht";
  const result = await loadReviewOverview(await createClient(), published);
  requireAdminAccess(result.access);
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Firmen & offizielle Gewerke</p>
      <h1>Adminbereich</h1>
      <p>Erstfreischaltung und Zuordnung zu offiziellen Gewerken.</p>
      <nav className={styles.actions} aria-label="Firmenansicht">
        <Link className="button" href="/admin">
          Erstfreischaltungen
        </Link>
        <Link className="button" href="/admin?ansicht=veroeffentlicht">
          Veröffentlichte Firmen
        </Link>
      </nav>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <>
          <dl className={styles.metrics}>
            <div>
              <dt>Zur Prüfung</dt>
              <dd>{result.counts?.pending}</dd>
            </div>
            <div>
              <dt>Freigegeben</dt>
              <dd>{result.counts?.approved}</dd>
            </div>
            <div>
              <dt>Änderungen erforderlich</dt>
              <dd>{result.counts?.rejected}</dd>
            </div>
          </dl>
          <h2>
            {published
              ? "Veröffentlichte Firmen"
              : "Zur erstmaligen Freischaltung"}
          </h2>
          {!result.profiles?.length ? (
            <p>Keine Firmenprofile in dieser Ansicht.</p>
          ) : (
            <ul className={styles.queue}>
              {result.profiles.map((profile) => (
                <li className={styles.card} key={profile.id}>
                  <h3>{legalName(profile.companies)}</h3>
                  <p>Öffentlicher Profilname: {profile.display_name}</p>
                  <p>
                    {[profile.city, profile.region]
                      .filter(Boolean)
                      .join(", ") || "Kein Standort angegeben"}
                  </p>
                  <p>Eingereicht: {formatSubmission(profile.submitted_at)}</p>
                  <Link
                    className="button button-primary"
                    href={`/admin/firmen/${profile.id}`}
                  >
                    {published ? "Gewerke bearbeiten" : "Firma freischalten"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
