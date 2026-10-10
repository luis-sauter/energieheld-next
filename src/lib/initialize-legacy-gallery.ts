import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReviewProfile } from "./admin-review";
import { companyProfileListing } from "./company-presentation";
import { withLegacyImages } from "./reiseportal-directory";
import { prepareLibraryImageCopy } from "./media-library-server";
import { GALLERY_LIMIT, type MediaState } from "./company-media";
import type { MediaAsset } from "./media-library";

export async function initializeLegacyGallery(client: SupabaseClient, profileId: string): Promise<MediaState> {
  const review = await loadReviewProfile(client, profileId);
  if (review.access !== "admin" || review.error || !review.profile) return { error: "Keine Berechtigung oder Profil nicht verfügbar." };
  // Check migration readiness before any copy/write; do not silently drop legacy images.
  const state = await client.from("company_profiles").select("gallery_initialized").eq("id", profileId).maybeSingle();
  if (state.error || !state.data) return { error: "Die Galerieübernahme ist noch nicht freigeschaltet. Die bestehenden Bilder bleiben erhalten." };
  if (state.data.gallery_initialized || review.profile.company_profile_images.length) return { error: "Die Galerie hat sich geändert. Bitte laden Sie das Profil neu." };
  const source = withLegacyImages(companyProfileListing(review.profile, { images: [] })).images;
  const images = [...new Map(source.map(image => [image.src, image])).values()];
  if (!images.length || images.length > GALLERY_LIMIT) return { error: "Die historischen Galeriebilder konnten nicht vollständig zugeordnet werden." };
  const loaded = await client.from("media_library_assets").select("*").eq("profile_id", profileId).eq("bucket_id", "project-media")
    .in("storage_path", images.map(image => image.src)).is("archived_at", null).is("deletion_requested_at", null);
  if (loaded.error) return { error: "Die Mediathek ist gerade nicht verfügbar." };
  const assets = new Map((loaded.data ?? []).map(asset => [asset.storage_path, asset as MediaAsset]));
  if (images.some(image => !assets.has(image.src))) return { error: "Nicht alle bestehenden Bilder sind eindeutig in der Mediathek zugeordnet. Es wurde keine Galerie geändert." };
  const paths: string[] = [];
  for (const image of images) {
    const copied = await prepareLibraryImageCopy(client, assets.get(image.src)!, { profileId, kind: "gallery" });
    if (!copied.path) return { error: copied.error ?? "Die Galerie konnte nicht vollständig vorbereitet werden. Die Originalbilder bleiben erhalten." };
    paths.push(copied.path);
  }
  const applied = await client.rpc("initialize_profile_gallery", { p_profile: profileId, p_paths: paths, p_alts: images.map(image => image.alt.slice(0, 500)) });
  if (applied.error) return { error: "Die Galerie konnte nicht übernommen werden oder wurde inzwischen geändert. Bitte laden Sie das Profil neu. Die Originalbilder bleiben erhalten." };
  return { success: "Bestehende Galerie übernommen. Alle Bilder sind jetzt bearbeitbar." };
}
