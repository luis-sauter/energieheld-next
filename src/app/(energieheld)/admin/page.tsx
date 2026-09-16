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

export default async function AdminPage() {
  const result = await loadReviewOverview(await createClient());
  requireAdminAccess(result.access);
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Firmenprüfung</p>
      <h1>Adminbereich</h1>
      <p className="lead">Eingereichte Firmenprofile</p>
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
          <h2>Zur Prüfung</h2>
          {!result.profiles?.length ? (
            <p>Derzeit warten keine Firmenprofile auf Prüfung.</p>
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
                    Profil prüfen
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
