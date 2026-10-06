import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { loadAdCampaigns } from "@/lib/ad-campaigns";
import { createCampaign } from "@/app/(energieheld)/firma/werbung/actions";
import { createAdminCampaign } from "@/app/(energieheld)/admin/werbung/actions";
import { CampaignFacts, CampaignList, CampaignSlot } from "./campaign-view";
import { CampaignForm, AdminCampaignForm } from "./campaign-form";
import styles from "./advertising.module.css";
import { loadBannerMetadata } from '@/lib/banner-search-metadata';
import { CampaignLifecycle } from './campaign-lifecycle';
type Params = { seite?: string; fehler?: string; archiv?: string };
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
  const client = await createClient();
  const archivedOnly = admin && params.archiv === '1';
  const result = await loadAdCampaigns(client, admin, page, undefined, archivedOnly);
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
      <h1>{admin ? "Werbekampagnen prüfen" : "Meine Angebotsanfragen"}</h1>
      {admin && campaigns?.some(campaign => Object.hasOwn(campaign, 'archived_at')) && <nav className={styles.actions} aria-label="Kampagnenbestand">
        <Link href="/admin/werbung" aria-current={!archivedOnly ? 'page' : undefined}>Alle Kampagnen</Link>
        <Link href="/admin/werbung?archiv=1" aria-current={archivedOnly ? 'page' : undefined}>Archiv</Link>
      </nav>}
      {admin && campaigns?.length && !Object.hasOwn(campaigns[0], 'archived_at') ? <p role="status">Die Archivverwaltung wird nach der Datenbankaktualisierung verfügbar.</p> : null}
      <p className={styles.intro}>
        {admin
          ? "Prüfen Sie Anzeigen und bestätigen Sie freie Zeiträume. Werbung bleibt unabhängig von Profilfreischaltung und Qualitätssiegel."
          : "Planen Sie Ihre Anzeige auf der Startseite oder bei Unterkünfte A–Z. Seite, Platz und Zeitraum werden vor der Veröffentlichung geprüft."}
      </p>
      {!admin && (
        <form action={createCampaign}>
          <button className="button button-primary">Neue Angebotsanfrage</button>
        </form>
      )}
      {admin && <form action={createAdminCampaign} className={styles.form}>
        <label>Banner für Anbieter anlegen
          <select name="profile_id" required defaultValue="">
            <option value="" disabled>Anbieter auswählen</option>
            {(await client.from("company_profiles").select("id,display_name").order("display_name")).data?.map((profile) =>
              <option key={profile.id} value={profile.id}>{profile.display_name}</option>
            )}
          </select>
        </label>
        <button className="button button-primary">Banner anlegen</button>
      </form>}
      {params.fehler && (
        <p role="alert">
          {admin ? "Das Banner" : "Die Angebotsanfrage"} konnte nicht erstellt werden. Bitte versuchen Sie es
          erneut.
        </p>
      )}
      {"error" in result && result.error && <p role="alert">{result.error}</p>}
      {campaigns && (
        <>
          {!campaigns.length && <p>{admin ? "Noch keine Kampagnen in dieser Ansicht." : "Noch keine Angebotsanfragen in dieser Ansicht."}</p>}
          <CampaignList campaigns={campaigns} admin={admin} />
        </>
      )}
      <nav className={styles.actions} aria-label={admin ? "Kampagnenseiten" : "Seiten der Angebotsanfragen"}>
        {page > 1 && (
          <Link href={`${base}/werbung?seite=${page - 1}${archivedOnly ? '&archiv=1' : ''}`}>
            ← Vorherige Seite
          </Link>
        )}
        {count > page * 20 && (
          <Link href={`${base}/werbung?seite=${page + 1}${archivedOnly ? '&archiv=1' : ''}`}>
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
  const client = await createClient();
  const result = await loadAdCampaigns(client, admin, 1, id);
  if ("unauthenticated" in result && result.unauthenticated) redirect("/login");
  if ("access" in result) requireAdminAccess(result.access ?? "forbidden");
  const campaign = "campaigns" in result ? result.campaigns?.[0] : undefined;
  if (!campaign && !("error" in result && result.error)) notFound();
  const metadata = admin && campaign ? await loadBannerMetadata(client, [`campaign:${campaign.id}`]) : undefined;
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <Link href={`${admin ? "/admin" : "/firma"}/werbung`}>
        {admin ? "← Zur Kampagnenübersicht" : "← Zur Übersicht der Angebotsanfragen"}
      </Link>
      <h1>{admin ? "Werbekampagne prüfen" : "Angebotsanfrage"}</h1>
      {"error" in result && result.error && <p role="alert">{result.error}</p>}
      {campaign && (
        <div className={styles.card}>
          <p className="eyebrow">{campaign.companyName}</p>
          <h2>{campaign.internal_name || (admin ? "Neue Werbekampagne" : "Neue Angebotsanfrage")}</h2>
          <CampaignFacts campaign={campaign} />
          {campaign.archived_at ? <>
            {admin && <CampaignLifecycle id={campaign.id} archived />}
            <CampaignSlot placement={campaign.placement} ad={campaign} preview />
            <p>Archiviert am {new Date(campaign.archived_at).toLocaleDateString('de-DE')}. Dieses Original ist nicht bearbeitbar und wird nicht öffentlich ausgeliefert.</p>
          </> : admin ? (
            <>
              <h3>Banner gestalten und zuordnen</h3>
              <CampaignForm campaign={campaign} categoryIds={[]} admin bannerMetadata={metadata?.values.get(`campaign:${campaign.id}`)} bannerTerms={metadata?.terms} />
              {Object.hasOwn(campaign, 'archived_at') && <CampaignLifecycle id={campaign.id} archived={false} />}
              <h3>Freigabe</h3>
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
            <CampaignForm
              key={campaign.id}
              campaign={campaign}
              categoryIds={
                "categoryIds" in result ? (result.categoryIds ?? []) : []
              }
            />
          ) : (
            <>
              <CampaignSlot
                placement={campaign.placement}
                ad={campaign}
                preview
              />
              <p>Diese Angebotsanfrage ist in diesem Status nicht bearbeitbar.</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
