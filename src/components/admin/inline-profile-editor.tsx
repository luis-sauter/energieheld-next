"use client";

import { ContactImageEditor } from "@/components/auth/contact-image-editor";
import { ProfileFreshness } from './profile-freshness';
import type { ContentFreshness } from '@/lib/content-freshness';
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListingDetail, type InlineProfileFields } from "@/components/portal/listing-detail";
import { useInlineAdminMedia } from "./use-inline-admin-media";
import type { Category, Listing } from "@/types/portal";
import type { ProfileValues, ProfileFormState } from "@/lib/company-profile";
import type { MediaRow, MediaState, SignedMedia } from "@/lib/company-media";
import styles from "./inline-profile.module.css";
import { splitProfileContent, type ProfileContentBlock } from "@/lib/profile-content";
import { EditorialTextarea } from "./editorial-textarea";
import { FixedHeadingEditor, InlineContentEditor, SectionPartFrame } from "./inline-content-editor";
import type { EditorialItem } from "@/lib/profile-content";
import { InlineEditorHistoryContext, useInlineEditorHistoryController } from "./inline-editor-history";

import Link from "next/link";

import { MediaLibraryProvider } from "./media-library-context";

export function InlineProfileEditor(props: React.ComponentProps<typeof ProfileEditor>) {
  return <MediaLibraryProvider profileId={props.listing.id} profileName={props.listing.name}><ProfileEditor {...props} /></MediaLibraryProvider>;
}

const formId = "inline-admin-profile-form";

function ProfileEditor({ listing, categories, values, media, rows, contactAction, saveProfile, saveMedia, contentBlocks, publicContentBlocks, contentAvailable, imagesAvailable, saveContent, saveBlockImage, initialEditing = false, returnHref, showVerification = true, allowDemoMap = false, originalDemoMedia = false, freshness, reviewFreshness, withdrawFreshness }: {
  listing: Listing;
  categories: Category[];
  values: ProfileValues;
  media: SignedMedia;
  rows: MediaRow[];
  contactAction?: React.ReactNode;
  saveProfile: (form: FormData) => Promise<ProfileFormState>;
  saveMedia: (form: FormData) => Promise<MediaState>;
  contentBlocks: ProfileContentBlock[];
  publicContentBlocks?: ProfileContentBlock[];
  contentAvailable: boolean;
  imagesAvailable: boolean;
  saveContent: (form: FormData) => Promise<{ error?: string; success?: string }>;
  saveBlockImage: (form: FormData) => Promise<MediaState>;
  initialEditing?: boolean;
  returnHref?: string;
  showVerification?: boolean;
  allowDemoMap?: boolean;
  originalDemoMedia?: boolean;
  freshness?: ContentFreshness | null;
  withdrawFreshness?: (revision: number, reviewedAt: string) => Promise<{ error?: string; success?: string }>;
  reviewFreshness?: (revision: number) => Promise<{ error?: string; success?: string }>;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<ProfileFormState>({});
  const [mapLocation, setMapLocation] = useState(listing.location);
  const history = useInlineEditorHistoryController(saveContent, saveBlockImage, editing);
  const mediaEditor = useInlineAdminMedia({ saveAction: saveMedia, media, rows, profileName: listing.name, initials: listing.initials });
  const content = splitProfileContent(editing ? contentBlocks : publicContentBlocks ?? contentBlocks, listing.name);

  function field(name: keyof ProfileValues, label: string, multiline = false) {
    const common = { id: `inline-${name}`, name, form: formId, defaultValue: values[name], maxLength: name.startsWith("contact_") ? 120 : undefined, disabled: busy || contactBusy || history.busy, "aria-label": label, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFeedback({});
      setDirty(true);
      const key = ({ street: "street", postal_code: "postalCode", city: "city", region: "region", country: "country" } as const)[name as "street" | "postal_code" | "city" | "region" | "country"];
      if (key) setMapLocation((current) => ({ ...current, [key]: event.target.value }));
    } };
    // Replace uncontrolled inputs when the server snapshot changes (including a stale review).
    return <label key={`${name}-${values[name]}`} className={styles.field} htmlFor={common.id}>
      <span>{label}</span>
      {multiline ? (name === "description" || name === "business_areas" ? <EditorialTextarea {...common} /> : <textarea {...common} rows={3} />) : <input {...common} type={name === "public_email" ? "email" : name === "website" ? "url" : name === "phone" ? "tel" : "text"} required={name === "display_name"} />}
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
    country: field("country", "Land"),
  };

  function renderSpecial(item: EditorialItem) {
    const about = item.kind === "about";
    return <div className={styles.specialSection}>
      <FixedHeadingEditor key={`${item.key}-${item.heading}-${item.headingHidden}-${item.headingAlign}`}
        slot={about ? "about_heading" : "business_areas_heading"} sectionKey={item.key}
        value={item.heading} align={item.headingAlign} hidden={item.headingHidden}
        defaultText={about ? `Über ${listing.name}` : "Tätigkeitsbereiche"} saveAction={saveContent} />
      <SectionPartFrame key={`${item.key}-text-${item.bodyAlign}-${about ? values.description : values.business_areas}`}
        sectionKey={item.key} part="text" align={item.bodyAlign}
        missing={!(about ? values.description : values.business_areas)?.trim()} saveAction={saveContent}>
        {about ? inlineFields.description : inlineFields.business_areas}
        <button type="submit" form={formId} className="button" disabled={busy || history.busy}>
          {busy ? "Wird gespeichert …" : about ? "Beschreibung speichern" : "Tätigkeitsbereiche speichern"}
        </button>
      </SectionPartFrame>
    </div>;
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || contactBusy || mediaEditor.busy || history.busy) return;
    const closeAfterSuccess = (event.nativeEvent.submitter as HTMLButtonElement | null)?.value === "close";
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    try {
      const result = await saveProfile(new FormData(event.currentTarget));
      setFeedback(result);
      if (result.success && !result.error) {
        setDirty(false);
        if (closeAfterSuccess) { setEditing(false); history.clear(); }
        router.refresh();
      }
    } catch {
      setFeedback({ error: "Das Profil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return <InlineEditorHistoryContext.Provider value={history}>
    {!editing && returnHref && <p><Link className="button" href={returnHref}>Zur Profilprüfung</Link></p>}
    {editing && <div className={styles.toolbar}>
      {returnHref && <Link className="button" href={returnHref} onNavigate={(event) => {
        if (busy || contactBusy || mediaEditor.busy || history.busy || (dirty && !window.confirm("Ungespeicherte Profilangaben verwerfen und zur Profilprüfung zurückkehren?"))) event.preventDefault();
      }}>Zur Profilprüfung</Link>}
      <strong>Bearbeitungsmodus aktiv</strong>
      <button type="button" className="button" disabled={busy || contactBusy || mediaEditor.busy || history.busy || !history.state.past.length}
        onClick={() => void history.undo()}>↶ Rückgängig</button>
      <button type="button" className="button" disabled={busy || contactBusy || mediaEditor.busy || history.busy || !history.state.future.length}
        onClick={() => void history.redo()}>↷ Wiederholen</button>
      <form id={formId} onSubmit={submit}>
        <button type="submit" value="stay" className="button button-primary" disabled={busy || contactBusy || mediaEditor.busy || history.busy}>{busy ? "Wird gespeichert …" : "Speichern"}</button>
        <button type="submit" value="close" className="button" disabled={busy || contactBusy || mediaEditor.busy || history.busy}>Speichern und schließen</button>
        <button type="button" className="button" disabled={busy || contactBusy || mediaEditor.busy || history.busy} onClick={() => { setEditing(false); setDirty(false); setFeedback({}); history.clear(); }}>Abbrechen</button>
      </form>
      {busy && <span role="status">Änderungen werden gespeichert …</span>}
      {history.busy && <span role="status">Änderung wird wiederhergestellt …</span>}
      {history.feedback.success && <span role="status" className={styles.success}>{history.feedback.success}</span>}
      {history.feedback.error && <span role="alert" className={styles.error}>{history.feedback.error}</span>}
      {feedback.success && <span role="status" className={styles.success}>{feedback.success}</span>}
      {feedback.error && <span role="alert" className={styles.error}>{feedback.error}</span>}
      {mediaEditor.status}
      <small>Inhalts- und Bildänderungen werden sofort gespeichert.</small>
    </div>}
    {!editing && feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
    {editing && freshness && <ProfileFreshness state={freshness} review={reviewFreshness} withdraw={withdrawFreshness} disabled={busy || contactBusy || mediaEditor.busy || history.busy || dirty} />}
    <ListingDetail
      listing={listing}
      showVerification={showVerification}
      categories={categories}
      presentation="company"
      showMap
      allowDemoMap={allowDemoMap}
      mapLocation={editing ? mapLocation : undefined}
      originalDemoMedia={originalDemoMedia}
      contactAction={editing ? undefined : contactAction}
      adminAction={editing ? undefined : <div className="profile-admin-actions">
        <button type="button" className={`button ${styles.editButton}`} onClick={() => { setFeedback({}); setEditing(true); }}>Profil bearbeiten</button>
        {freshness && <ProfileFreshness state={freshness} review={reviewFreshness} withdraw={withdrawFreshness} disabled={busy || contactBusy || mediaEditor.busy || history.busy || dirty} compact />}
      </div>}
      inlineFields={editing ? inlineFields : undefined}
      aboutHeading={content.aboutHeading}
      businessHeading={content.businessHeading}
      editorialContent={contentAvailable && (editing || listing.description || listing.businessAreas || content.blocks.length)
        ? <InlineContentEditor key={editing ? "edit" : "view"}
        blocks={content.blocks} items={content.items} listing={listing} renderSpecial={renderSpecial}
        editing={editing} available={contentAvailable} imagesAvailable={imagesAvailable}
        saveAction={saveContent} saveImage={saveBlockImage} /> : undefined}
      contactPersonEditor={editing ? <section aria-label="Ansprechpartner bearbeiten">
        <h3>Ansprechpartner (optional)</h3>
        {field("contact_first_name", "Vorname")}{field("contact_last_name", "Nachname")}
        <ContactImageEditor contact={listing.contact} save={saveMedia} disabled={busy || mediaEditor.busy || history.busy} onBusyChange={setContactBusy} />
      </section> : undefined}
      logoEditor={editing ? mediaEditor.logoEditor : undefined}
      galleryEditor={editing ? mediaEditor.galleryEditor : undefined}
    />
    {editing && mediaEditor.uploadDialog}
  </InlineEditorHistoryContext.Provider>;
}
