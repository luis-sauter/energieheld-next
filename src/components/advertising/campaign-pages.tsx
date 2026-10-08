import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { loadAdCampaigns } from "@/lib/ad-campaigns";
import { createCampaign } from "@/app/(energieheld)/firma/werbung/actions";
import { campaignInlinePage } from "@/lib/editorial-workspace";
import { inlineAdContext } from "@/lib/inline-ad-context";
import { loadBannerPresentations } from "@/lib/banner-presentation-loader";
import { displayPlacement } from "@/lib/banner-presentation";
import { CampaignFacts, CampaignList, CampaignSlot } from "./campaign-view";
import { CampaignForm, AdminCampaignForm } from "./campaign-form";
import styles from "./advertising.module.css";
import { loadBannerMetadata } from '@/lib/banner-search-metadata';
import { CampaignLifecycle } from './campaign-lifecycle';
type Params = { seite?: string; fehler?: string; archiv?: string; ansicht?: string };
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
  const pendingOnly = admin && params.ansicht === "pruefung" && !archivedOnly;
  const result = await loadAdCampaigns(client, admin, page, undefined, archivedOnly, pendingOnly);
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
      <h1>{admin ? (pendingOnly ? "Werbeanfragen prüfen" : "Werbung verwalten") : "Meine Angebotsanfragen"}</h1>
      {admin && <nav className={styles.actions} aria-label="Kampagnenbestand">
        <Link href="/admin/werbung?ansicht=pruefung" aria-current={pendingOnly ? "page" : undefined}>Offene Angebotsanfragen</Link>
        <Link href="/admin/werbung" aria-current={!archivedOnly && !pendingOnly ? 'page' : undefined}>Alle Kampagnen</Link>
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
          <CampaignList campaigns={campaigns} admin={admin} requestsOnly={pendingOnly} />
        </>
      )}
      <nav className={styles.actions} aria-label={admin ? "Kampagnenseiten" : "Seiten der Angebotsanfragen"}>
        {page > 1 && (
          <Link href={`${base}/werbung?seite=${page - 1}${archivedOnly ? '&archiv=1' : pendingOnly ? '&ansicht=pruefung' : ''}`}>
            ← Vorherige Seite
          </Link>
        )}
        {count > page * 20 && (
          <Link href={`${base}/werbung?seite=${page + 1}${archivedOnly ? '&archiv=1' : pendingOnly ? '&ansicht=pruefung' : ''}`}>
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
  const inlinePath = admin && campaign ? campaignInlinePage(campaign) : null;
  const presentation = inlinePath ? await loadBannerPresentations(client, inlineAdContext(inlinePath)!) : null;
  const inlineHref = inlinePath && !presentation?.error ? `${inlinePath}#banner-${displayPlacement(campaign!.targets[0].placement, presentation?.rows ?? [])}` : null;
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
              <h3>Anfrage und Zeitraum prüfen</h3>
              {inlineHref ? <p><Link className="button button-primary" href={inlineHref}>Banner auf der Seite gestalten</Link> · Derselbe Banner, am tatsächlichen Platz.</p> : <p>Dieser Banner wird hier sicher bearbeitet. Geplante, geteilte oder noch nicht freigegebene Kampagnen werden nicht automatisch auf einer Seite veröffentlicht.</p>}
              <CampaignForm campaign={campaign} categoryIds={[]} admin bannerMetadata={metadata?.values.get(`campaign:${campaign.id}`)} bannerTerms={metadata?.terms} bannerAdvertisers={metadata?.advertisers} />
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
              {campaign.status === "pending" && (
                <p role="status">Ihre Angebotsanfrage wurde erfolgreich gesendet.</p>
              )}
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
