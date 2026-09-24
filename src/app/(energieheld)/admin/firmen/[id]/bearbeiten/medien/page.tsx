import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile } from "@/lib/admin-review";
import { requireAdminAccess } from "@/lib/admin";
import { signCompanyMedia } from "@/lib/company-media";
import { AdminMediaEditor } from "@/components/admin/admin-media-editor";
import { saveAdminMedia } from "./actions";
import styles from "@/components/admin/admin.module.css";

export const metadata = {
  title: "Profilmedien bearbeiten",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminMediaPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await createClient();
  const result = await loadReviewProfile(client, id);
  requireAdminAccess(result.access);
  if (!result.error && !result.profile) notFound();
  const profile = result.profile;
  let media;
  if (profile && !result.error) {
    try {
      media = await signCompanyMedia(client, profile);
    } catch {
      // Keep media editing unavailable if private URLs cannot be signed.
    }
  }

  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <Link href={`/admin/firmen/${id}/bearbeiten`}>← Zurück zu den Profilangaben</Link>
      <h1>Logo und Bilder bearbeiten</h1>
      <p>Wählen Sie Bilder aus, beschreiben Sie sie und ordnen Sie die Galerie durch Ziehen.</p>
      {result.error || !profile || !media ? (
        <p role="alert">
          {result.error ?? "Die Profilmedien konnten nicht geladen werden. Bitte versuchen Sie es erneut."}
        </p>
      ) : (
        <AdminMediaEditor
          saveAction={saveAdminMedia.bind(null, profile.id)}
          profileName={profile.display_name}
          logo={media.logo}
          images={media.images}
          rows={profile.company_profile_images}
        />
      )}
    </main>
  );
}
