"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileContentBlocks } from "@/components/portal/profile-content-blocks";
import { InlineImageGridEditor } from "./inline-image-grid-editor";
import type { MediaState } from "@/lib/company-media";
import type { ContentBlockType, HeadingSlot, ProfileContentBlock } from "@/lib/profile-content";
import styles from "./inline-profile.module.css";

type ContentState = { error?: string; success?: string };
type SaveContent = (form: FormData) => Promise<ContentState>;

export function FixedHeadingEditor({ slot, value, defaultText, saveAction }: {
  slot: HeadingSlot;
  value: string;
  defaultText: string;
  saveAction: SaveContent;
}) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ContentState>({});
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback({});
    const form = new FormData();
    form.set("intent", "heading");
    form.set("slot", slot);
    form.set("text", text);
    try {
      const result = await saveAction(form);
      setFeedback(result);
      if (result.success) {
        if (!text.trim()) setText(defaultText);
        router.refresh();
      }
    } catch {
      setFeedback({ error: "Die Überschrift konnte nicht gespeichert werden." });
    } finally {
      setBusy(false);
    }
  }
  return <form className={styles.headingForm} onSubmit={submit}>
    <label htmlFor={`fixed-${slot}`}>
      <span>Überschrift</span>
      <input id={`fixed-${slot}`} value={text} maxLength={200} disabled={busy}
        onChange={(event) => { setText(event.target.value); setFeedback({}); }} />
    </label>
    <button className="button" disabled={busy}>{busy ? "Wird gespeichert …" : "Überschrift speichern"}</button>
    {feedback.error && <span role="alert" className={styles.error}>{feedback.error}</span>}
    {feedback.success && <span role="status" className={styles.success}>{feedback.success}</span>}
  </form>;
}

export function InlineContentEditor({ blocks, editing, available, imagesAvailable, saveAction, saveImage }: {
  blocks: ProfileContentBlock[];
  editing: boolean;
  available: boolean;
  imagesAvailable: boolean;
  saveAction: SaveContent;
  saveImage: (form: FormData) => Promise<MediaState>;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ContentState>({});
  const [pickerBefore, setPickerBefore] = useState<string | null | undefined>();
  const [draft, setDraft] = useState<{ type: ContentBlockType; before: string | null } | null>(null);
  if (!editing) return blocks.length ? <ProfileContentBlocks blocks={blocks} /> : null;
  if (!available) return <p role="status" className={styles.contentUnavailable}>Inhaltsblöcke werden verfügbar, sobald die neue Datenbankmigration angewendet ist.</p>;

  async function run(form: FormData, onSuccess?: () => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    try {
      const result = await saveAction(form);
      setFeedback(result);
      if (result.success) {
        onSuccess?.();
        router.refresh();
      }
    } catch {
      setFeedback({ error: "Der Inhalt konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function formFor(intent: string, blockId?: string) {
    const form = new FormData();
    form.set("intent", intent);
    if (blockId) form.set("block_id", blockId);
    return form;
  }
  function addControl(before: string | null) {
    const selected = pickerBefore === before;
    const activeDraft = draft?.before === before;
    return <div className={styles.insertArea} key={`add-${before ?? "end"}`}>
      {!activeDraft && <button type="button" className={`button ${styles.addButton}`} disabled={busy}
        onClick={() => { setPickerBefore(selected ? undefined : before); setDraft(null); }}>
        + Inhalt hinzufügen
      </button>}
      {selected && !activeDraft && <div className={styles.blockPicker} aria-label="Inhaltstyp wählen">
        <button type="button" className="button" onClick={() => { setDraft({ type: "heading", before }); setPickerBefore(undefined); }}>Überschrift</button>
        <button type="button" className="button" onClick={() => { setDraft({ type: "text", before }); setPickerBefore(undefined); }}>Text</button>
        {imagesAvailable && <button type="button" className="button" disabled={busy} onClick={() => {
          const form = formFor("insert"); form.set("type", "image_grid");
          if (before) form.set("before_block_id", before);
          void run(form, () => setPickerBefore(undefined));
        }}>Bilder</button>}
      </div>}
      {activeDraft && <form className={styles.blockForm} onSubmit={(event) => {
        event.preventDefault();
        const form = formFor("insert");
        form.set("type", draft.type);
        form.set("text", String(new FormData(event.currentTarget).get("text") ?? ""));
        if (before) form.set("before_block_id", before);
        void run(form, () => setDraft(null));
      }}>
        <label>{draft.type === "heading" ? "Neue Überschrift" : "Neuer Text"}
          {draft.type === "heading"
            ? <input name="text" required maxLength={200} disabled={busy} autoFocus />
            : <textarea name="text" required maxLength={10000} rows={5} disabled={busy} autoFocus />}
        </label>
        <div className={styles.blockActions}>
          <button className="button button-primary" disabled={busy}>{busy ? "Wird gespeichert …" : "Block speichern"}</button>
          <button type="button" className="button" disabled={busy} onClick={() => setDraft(null)}>Abbrechen</button>
        </div>
      </form>}
    </div>;
  }

  return <div className={styles.contentEditor} aria-label="Profilinhalte bearbeiten">
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
    {blocks.map((block, index) => <div key={block.id}>
      {addControl(block.id)}
      <section className={`detail-section ${styles.editableBlock}`}>
        {block.type === "image_grid" ? <>
          <InlineImageGridEditor block={block} saveAction={saveImage} />
          <div className={styles.blockActions}>
            <button type="button" className="button" disabled={busy || index === 0} aria-label="Block nach oben verschieben"
              onClick={() => { const form = formFor("move", block.id); form.set("direction", "up"); void run(form); }}>↑</button>
            <button type="button" className="button" disabled={busy || index === blocks.length - 1} aria-label="Block nach unten verschieben"
              onClick={() => { const form = formFor("move", block.id); form.set("direction", "down"); void run(form); }}>↓</button>
            <button type="button" className="button" disabled={busy} onClick={() => {
              if (window.confirm("Diesen Bildblock samt Bildern wirklich löschen?")) void run(formFor("delete", block.id));
            }}>Block löschen</button>
          </div>
        </> : <form key={`${block.id}-${block.content.text}`} className={styles.blockForm} onSubmit={(event) => {
          event.preventDefault();
          const form = formFor("update", block.id);
          form.set("text", String(new FormData(event.currentTarget).get("text") ?? ""));
          void run(form);
        }}>
          <label>{block.type === "heading" ? "Überschrift" : "Text"}
            {block.type === "heading"
              ? <input name="text" defaultValue={block.content.text} required maxLength={200} disabled={busy} />
              : <textarea name="text" defaultValue={block.content.text} required maxLength={10000} rows={5} disabled={busy} />}
          </label>
          <div className={styles.blockActions}>
            <button className="button" disabled={busy}>{busy ? "Wird gespeichert …" : "Block speichern"}</button>
            <button type="button" className="button" disabled={busy || index === 0} aria-label="Block nach oben verschieben"
              onClick={() => { const form = formFor("move", block.id); form.set("direction", "up"); void run(form); }}>↑</button>
            <button type="button" className="button" disabled={busy || index === blocks.length - 1} aria-label="Block nach unten verschieben"
              onClick={() => { const form = formFor("move", block.id); form.set("direction", "down"); void run(form); }}>↓</button>
            <button type="button" className="button" disabled={busy} onClick={() => {
              if (window.confirm("Diesen Inhaltsblock wirklich löschen?")) void run(formFor("delete", block.id));
            }}>Block löschen</button>
          </div>
        </form>}
      </section>
    </div>)}
    {addControl(null)}
  </div>;
}
