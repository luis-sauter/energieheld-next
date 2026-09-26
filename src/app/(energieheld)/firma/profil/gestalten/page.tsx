import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { signCompanyMedia } from "@/lib/company-media";
import { companyProfileListing } from "@/lib/company-presentation";
import { CompanyProfileDesigner } from "@/components/auth/company-media-form";
import { CompanyPublication } from "@/components/auth/company-publication";
import { publicSlugForStoredProfile } from "@/lib/reiseportal-demo";

export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = {
  approved: "Veröffentlicht",
  pending: "Wartet auf Freischaltung",
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
  let media;
  if (profile && !dashboard.error) {
    try {
      media = await signCompanyMedia(client, profile);
    } catch {
      /* Show a neutral error below. */
    }
  }
  return (
    <main id="hauptinhalt" className="container detail-page">
      <div className="profile-editor-toolbar">
        <div>
          <h1>Profil gestalten</h1>
          <p>Bearbeiten Sie Logo und Unternehmensbilder direkt im Profil.</p>
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
          <CompanyPublication status={profile.status} />
        </>
      )}
      <Link className="text-link back-link" href="/firma">
        Zurück zum Firmenbereich
      </Link>
    </main>
  );
}
