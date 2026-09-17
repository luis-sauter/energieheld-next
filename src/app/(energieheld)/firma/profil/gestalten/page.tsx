import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { signCompanyMedia } from "@/lib/company-media";
import { companyProfileListing } from "@/lib/company-presentation";
import { CompanyProfileDesigner } from "@/components/auth/company-media-form";
import { CompanyPublication } from "@/components/auth/company-publication";

export const dynamic = "force-dynamic";
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
          <p>
            Schritt 2 von 2 · So erscheint Ihr Firmenprofil. Logo und Bilder
            bearbeiten Sie direkt an ihrer späteren Position.
          </p>
        </div>
        <Link href="/firma/profil">Stammdaten bearbeiten</Link>
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
          <CompanyPublication status={profile.status} slug={profile.slug} />
        </>
      )}
      <Link className="text-link back-link" href="/firma">
        Zurück zum Firmenbereich
      </Link>
    </main>
  );
}
