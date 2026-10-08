import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { signCompanyMedia } from "@/lib/company-media";
import { companyProfileListing } from "@/lib/company-presentation";
import { CompanyProfileDesigner } from "@/components/auth/company-media-form";
import { CompanyPublication } from "@/components/auth/company-publication";
import { publicSlugForStoredProfile } from "@/lib/reiseportal-demo";
import { loadEditorialNote, loadOwnerTravelInput } from "@/lib/owner-profile-input";
import { EditorialNoteForm } from "@/components/auth/editorial-note-form";
import { TravelSignals } from "@/components/portal/travel-signals";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = {
  approved: "Veröffentlicht",
  pending: "Wartet auf redaktionelle Prüfung",
  draft: "Entwurf",
  rejected: "Änderungen erforderlich",
};
export const metadata = {
  title: "Firmenprofil gestalten",
  robots: { index: false, follow: false },
};
export default async function CompanyDesignPage() {
  const client = await createClient();
  const dashboard = await loadCompanyDashboard(client);
  if (!dashboard.authenticated) redirect("/login");
  const profile = dashboard.profile;
  const [note, travel] = profile && !dashboard.error ? await Promise.all([
    loadEditorialNote(client, profile.id), loadOwnerTravelInput(client, profile.id),
  ]) : [null, null];
  let media;
  if (profile && !dashboard.error) {
    try {
      media = await signCompanyMedia(client, profile, true);
    } catch {
      /* Show a neutral error below. */
    }
  }
  return (
    <main id="hauptinhalt" className="container detail-page">
      <div className="profile-editor-toolbar">
        <div>
          <p className="eyebrow">Schritt 2 von 2</p>
          <h1>Profil gestalten</h1>
          <h2>Zeigen Sie uns Ihre Unterkunft von ihrer schönsten Seite</h2>
          <p>Laden Sie Ihr Logo und aussagekräftige Bilder Ihrer Unterkunft hoch. Unsere Redaktion erstellt daraus ein ansprechendes Firmenprofil für DAS Reiseportal.</p>
          <p>Sie müssen hier keine fertigen Werbetexte verfassen oder das Layout selbst gestalten. Ihre Angaben aus dem vorherigen Schritt übernehmen wir als Grundlage. Besondere Wünsche können Sie uns unten als Hinweis mitteilen.</p>
          <p>Besonders hilfreich sind Bilder von Zimmern, Außenansichten, besonderen Angeboten und der Umgebung. Sie können bis zu 8 Galeriebilder hinzufügen.</p>
        </div>
        <div className="profile-toolbar-actions">
          {profile && (
            <span className="profile-status" data-status={profile.status}>
              {statusLabels[profile.status] ?? "Entwurf"}
            </span>
          )}
          <Link href="/firma/profil">Stammdaten bearbeiten</Link>
          {profile?.status === "approved" && (
            <Link href={`/unterkuenfte/${publicSlugForStoredProfile(profile)}`}>
              Öffentliches Profil ansehen ↗
            </Link>
          )}
        </div>
      </div>
      {dashboard.error || !profile || !media ? (
        <p role="alert">
          {dashboard.error ??
            "Die Profilvorschau konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut."}
        </p>
      ) : (
        <>
          <CompanyProfileDesigner
            listing={companyProfileListing(profile, media)}
            media={media}
          />
          {travel && ("error" in travel ? <p role="alert">{travel.error}</p> :
            <section aria-label="Gespeicherte Reisevorschläge"><h2>Ihre Reisevorschläge</h2>
              <p>Ihre gespeicherte Auswahl ist ein Vorschlag für die Redaktion, keine bestätigte öffentliche Zuordnung.</p>
              <TravelSignals termKeys={travel.proposedKeys} limit={30} />
              <p>{travel.terms.filter(term => term.dimension === "accommodation" && travel.proposedKeys.includes(term.term_key)).map(term => term.label).join(" · ")}</p>
            </section>)}
          {note && <EditorialNoteForm initialNote={"note" in note ? note.note : undefined} error={"error" in note ? note.error : undefined} />}
          <CompanyPublication status={profile.status} />
        </>
      )}
      <Link className="text-link back-link" href="/firma">
        Zurück zum Firmenbereich
      </Link>
    </main>
  );
}
