import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { loadAdCampaigns } from "@/lib/ad-campaigns";
import { createCampaign } from "@/app/(energieheld)/firma/werbung/actions";
import { CampaignFacts, CampaignList, CampaignSlot } from "./campaign-view";
import { CampaignForm, AdminCampaignForm } from "./campaign-form";
import styles from "./advertising.module.css";
type Params = { seite?: string; fehler?: string };
export async function CampaignIndex({
  admin = false,
  params,
}: {
  admin?: boolean;
  params: Params;
}) {
  const parsed = Number(params.seite ?? 1),
    page =
      Number.isSafeInteger(parsed) && parsed > 0 && parsed < 100000
        ? parsed
        : 1;
  const result = await loadAdCampaigns(await createClient(), admin, page);
  if ("unauthenticated" in result && result.unauthenticated) redirect("/login");
  if ("access" in result) requireAdminAccess(result.access ?? "forbidden");
  const campaigns = "campaigns" in result ? result.campaigns : undefined,
    count = "count" in result ? (result.count ?? 0) : 0;
  const base = admin ? "/admin" : "/firma";
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <Link href={base}>
        ← Zurück zum {admin ? "Adminbereich" : "Firmenbereich"}
      </Link>
      <h1>{admin ? "Werbekampagnen prüfen" : "Meine Werbekampagnen"}</h1>
      <p className={styles.intro}>
        {admin
          ? "Prüfen Sie Anzeigen und bestätigen Sie freie Zeiträume. Werbung bleibt unabhängig von Profilfreischaltung und Qualitätssiegel."
          : "Planen Sie Ihre Anzeige auf der Expertenübersicht oder den Gewerkeseiten. Platz und Zeitraum werden vor der Veröffentlichung geprüft."}
      </p>
      {!admin && (
        <form action={createCampaign}>
          <button className="button button-primary">Neue Werbekampagne</button>
        </form>
      )}
      {params.fehler && (
        <p role="alert">
          Die Kampagne konnte nicht erstellt werden. Bitte versuchen Sie es
          erneut.
        </p>
      )}
      {"error" in result && result.error && <p role="alert">{result.error}</p>}
      {campaigns && (
        <>
          {!campaigns.length && <p>Noch keine Kampagnen in dieser Ansicht.</p>}
          <CampaignList campaigns={campaigns} admin={admin} />
        </>
      )}
      <nav className={styles.actions} aria-label="Kampagnenseiten">
        {page > 1 && (
          <Link href={`${base}/werbung?seite=${page - 1}`}>
            ← Vorherige Seite
          </Link>
        )}
        {count > page * 20 && (
          <Link href={`${base}/werbung?seite=${page + 1}`}>
            Nächste Seite →
          </Link>
        )}
      </nav>
    </main>
  );
}
export async function CampaignDetail({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const result = await loadAdCampaigns(await createClient(), admin, 1, id);
  if ("unauthenticated" in result && result.unauthenticated) redirect("/login");
  if ("access" in result) requireAdminAccess(result.access ?? "forbidden");
  const campaign = "campaigns" in result ? result.campaigns?.[0] : undefined;
  if (!campaign && !("error" in result && result.error)) notFound();
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <Link href={`${admin ? "/admin" : "/firma"}/werbung`}>
        ← Zur Kampagnenübersicht
      </Link>
      <h1>{admin ? "Werbekampagne prüfen" : "Werbekampagne"}</h1>
      {"error" in result && result.error && <p role="alert">{result.error}</p>}
      {campaign && (
        <div className={styles.card}>
          <p className="eyebrow">{campaign.companyName}</p>
          <h2>{campaign.internal_name || "Neue Werbekampagne"}</h2>
          <CampaignFacts campaign={campaign} />
          {admin ? (
            <>
              <CampaignSlot
                placement={campaign.placement}
                ad={campaign}
                preview
              />
              <p>
                Ziel-URL:{" "}
                <a
                  href={campaign.target_url || undefined}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {campaign.target_url || "Noch nicht angegeben"}
                </a>
              </p>
              <AdminCampaignForm campaign={campaign} />
            </>
          ) : ["draft", "rejected"].includes(campaign.status) ? (
            <CampaignForm campaign={campaign} />
          ) : (
            <>
              <CampaignSlot
                placement={campaign.placement}
                ad={campaign}
                preview
              />
              <p>Diese Kampagne ist in diesem Status nicht bearbeitbar.</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
