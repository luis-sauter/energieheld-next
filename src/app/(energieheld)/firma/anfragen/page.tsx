import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadLeads, leadStatuses } from "@/lib/company-leads";
import { LeadStatusForm } from "@/components/leads/lead-status-form";
import styles from "@/components/leads/leads.module.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Anfragen",
  robots: { index: false, follow: false },
};
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ seite?: string }>;
}) {
  const { seite } = await searchParams;
  const parsed = Number(seite ?? 1),
    page =
      Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000
        ? parsed
        : 1;
  let result: Awaited<ReturnType<typeof loadLeads>>;
  try {
    result = await loadLeads(await createClient(), page);
  } catch {
    result = { error: "Ihre Anfragen konnten gerade nicht geladen werden." };
  }
  if ("unauthenticated" in result && result.unauthenticated) redirect("/login");
  return (
    <main id="hauptinhalt" className={`container ${styles.inbox}`}>
      <Link href="/firma" className="text-link">
        ← Zurück zum Firmenbereich
      </Link>
      <h1>Anfragen</h1>
      <p>Kontaktanfragen an Ihr Unternehmen – neueste zuerst.</p>
      {"error" in result && result.error && (
        <p role="alert" className={styles.error}>
          {result.error}
        </p>
      )}
      {"leads" in result && (
        <>
          {result.leads.length === 0 && (
            <p className={styles.empty}>Hier liegen noch keine Anfragen vor.</p>
          )}
          {result.leads.map((lead) => (
            <article key={lead.id} className={styles.lead}>
              <header>
                <h2>{lead.name}</h2>
                <span className={styles.badge}>
                  {leadStatuses[lead.status] ?? lead.status}
                </span>
                <time dateTime={lead.created_at}>
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/Berlin",
                  }).format(new Date(lead.created_at))}
                </time>
              </header>
              <dl>
                <dt>E-Mail</dt>
                <dd>
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                </dd>
                {lead.phone && (
                  <>
                    <dt>Telefon</dt>
                    <dd>{lead.phone}</dd>
                  </>
                )}
              </dl>
              <p className={styles.message}>{lead.message}</p>
              <LeadStatusForm
                key={`${lead.id}-${lead.status}`}
                id={lead.id}
                status={lead.status}
              />
            </article>
          ))}
          {(page > 1 || page * 25 < result.count) && (
            <nav className={styles.pagination} aria-label="Anfragenseiten">
              {page > 1 && <Link href={`?seite=${page - 1}`}>← Vorherige</Link>}
              <span>Seite {page}</span>
              {page * 25 < result.count && (
                <Link href={`?seite=${page + 1}`}>Weitere →</Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
