"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListingDetail, type InlineProfileFields } from "@/components/portal/listing-detail";
import { useInlineAdminMedia } from "./use-inline-admin-media";
import type { Category, Listing } from "@/types/portal";
import type { ProfileValues, ProfileFormState } from "@/lib/company-profile";
import type { MediaRow, MediaState, SignedMedia } from "@/lib/company-media";
import styles from "./inline-profile.module.css";
import { splitProfileContent, type ProfileContentBlock } from "@/lib/profile-content";
import { FixedHeadingEditor, InlineContentEditor } from "./inline-content-editor";

const formId = "inline-admin-profile-form";

export function InlineProfileEditor({ listing, categories, values, media, rows, contactAction, saveProfile, saveMedia, contentBlocks, contentAvailable, imagesAvailable, saveContent, saveBlockImage, initialEditing = false }: {
  listing: Listing;
  categories: Category[];
  values: ProfileValues;
  media: SignedMedia;
  rows: MediaRow[];
  contactAction?: React.ReactNode;
  saveProfile: (form: FormData) => Promise<ProfileFormState>;
  saveMedia: (form: FormData) => Promise<MediaState>;
  contentBlocks: ProfileContentBlock[];
  contentAvailable: boolean;
  imagesAvailable: boolean;
  saveContent: (form: FormData) => Promise<{ error?: string; success?: string }>;
  saveBlockImage: (form: FormData) => Promise<MediaState>;
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ProfileFormState>({});
  const mediaEditor = useInlineAdminMedia({ saveAction: saveMedia, media, rows, profileName: listing.name, initials: listing.initials });
  const content = splitProfileContent(contentBlocks, listing.name);

  function field(name: keyof ProfileValues, label: string, multiline = false) {
    const common = { id: `inline-${name}`, name, form: formId, defaultValue: values[name], disabled: busy, "aria-label": label, onChange: () => setFeedback({}) };
    return <label className={styles.field} htmlFor={common.id}>
      <span>{label}</span>
      {multiline ? <textarea {...common} rows={name === "description" ? 7 : 3} /> : <input {...common} type={name === "public_email" ? "email" : name === "website" ? "url" : name === "phone" ? "tel" : "text"} required={name === "display_name"} />}
    </label>;
  }
  const inlineFields: InlineProfileFields = {
    display_name: field("display_name", "Öffentlicher Profilname"),
    tagline: field("tagline", "Kurzbeschreibung", true),
    description: field("description", "Beschreibung", true),
    business_areas: field("business_areas", "Tätigkeitsbereiche", true),
    phone: field("phone", "Telefon"),
    public_email: field("public_email", "Öffentliche E-Mail"),
    website: field("website", "Website"),
    street: field("street", "Straße"),
    postal_code: field("postal_code", "PLZ"),
    city: field("city", "Ort"),
    region: field("region", "Region"),
  };

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || mediaEditor.busy) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    try {
      const result = await saveProfile(new FormData(event.currentTarget));
      setFeedback(result);
      if (result.success) router.refresh();
    } catch {
      setFeedback({ error: "Das Profil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return <>
    {editing && <div className={styles.toolbar}>
      <strong>Bearbeitungsmodus aktiv</strong>
      <form id={formId} onSubmit={submit}>
        <button className="button button-primary" disabled={busy || mediaEditor.busy}>{busy ? "Wird gespeichert …" : "Speichern"}</button>
        <button type="button" className="button" disabled={busy || mediaEditor.busy} onClick={() => { setEditing(false); setFeedback({}); }}>Abbrechen</button>
      </form>
      {busy && <span role="status">Änderungen werden gespeichert …</span>}
      {feedback.success && <span role="status" className={styles.success}>{feedback.success}</span>}
      {feedback.error && <span role="alert" className={styles.error}>{feedback.error}</span>}
      {mediaEditor.status}
      <small>Inhalts- und Bildänderungen werden sofort gespeichert.</small>
    </div>}
    <ListingDetail
      listing={listing}
      categories={categories}
      presentation="company"
      showMap
      contactAction={editing ? undefined : contactAction}
      adminAction={editing ? undefined : <button type="button" className={`button ${styles.editButton}`} onClick={() => { setFeedback({}); setEditing(true); }}>Profil bearbeiten</button>}
      inlineFields={editing ? inlineFields : undefined}
      aboutHeading={content.aboutHeading}
      businessHeading={content.businessHeading}
      aboutHeadingEditor={editing && contentAvailable
        ? <FixedHeadingEditor key={content.aboutHeading} slot="about_heading" value={content.aboutHeading} defaultText={`Über ${listing.name}`} saveAction={saveContent} /> : undefined}
      businessHeadingEditor={editing && contentAvailable
        ? <FixedHeadingEditor key={content.businessHeading} slot="business_areas_heading" value={content.businessHeading} defaultText="Tätigkeitsbereiche" saveAction={saveContent} /> : undefined}
      contentBlocks={editing || content.blocks.length
        ? <InlineContentEditor key={editing ? "edit" : "view"} blocks={content.blocks} editing={editing} available={contentAvailable} imagesAvailable={imagesAvailable} saveAction={saveContent} saveImage={saveBlockImage} />
        : undefined}
      logoEditor={editing ? mediaEditor.logoEditor : undefined}
      galleryEditor={editing ? mediaEditor.galleryEditor : undefined}
    />
    {editing && mediaEditor.uploadDialog}
  </>;
}
