"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContactPerson } from "@/components/portal/contact-person";
import { uploadAdminMedia } from "@/lib/admin-media-upload";
import type { MediaState } from "@/lib/company-media";
import type { Listing } from "@/types/portal";
import styles from "./contact-image-editor.module.css";

export function ContactImageEditor({ contact, save, disabled = false, onBusyChange }: {
  contact: Listing["contact"]; save: (form: FormData) => Promise<MediaState>; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);
  const [status, setStatus] = useState<MediaState>({});
  const [progress, setProgress] = useState("");
  async function run(file?: File) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setStatus({});
    if (file) setPreview(URL.createObjectURL(file));
    try {
      const form = new FormData(); form.set("intent", "contact-remove");
      const result = file ? await uploadAdminMedia(save, "contact", file, "", setProgress) : await save(form);
      setStatus(result);
      if (result.success) router.refresh();
    } catch { setStatus({ error: "Das Ansprechpartnerbild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." }); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); setProgress(""); setPreview(null); }
  }
  return <div className={styles.editor} aria-busy={busy}>
    <ContactPerson contact={preview ? { ...contact, personImage: { src: preview, alt: "Vorschau des Ansprechpartnerbildes" } } : contact} />
    {!contact.personImage && !preview && <div className={styles.placeholder}>Kein Ansprechpartnerbild</div>}
    <div className={styles.actions}>
    <button type="button" className="button" disabled={disabled || busy} onClick={() => input.current?.click()}>{contact.personImage ? "Ansprechpartnerbild ändern" : "Ansprechpartnerbild hinzufügen"}</button>
    <input ref={input} type="file" hidden aria-label="Ansprechpartnerbild auswählen" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void run(file); }} />
    {contact.personImage && <button type="button" className="button" disabled={disabled || busy} onClick={() => void run()}>Ansprechpartnerbild entfernen</button>}
    </div>
    <p>JPG, PNG oder WebP · maximal 5 MB nach Bildoptimierung</p>
    <p>Bildänderungen werden direkt gespeichert. Namen speichern Sie mit „Speichern“ oder „Speichern und schließen“.</p>
    {busy && <p role="status">{progress || "Bild wird gespeichert …"}</p>}
    {status.error && <p role="alert">{status.error}</p>}
    {status.success && <p role="status">{status.success}</p>}
  </div>;
}
