"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileContentBlocks } from "@/components/portal/profile-content-blocks";
import { InlineImageGridEditor } from "./inline-image-grid-editor";
import { InlineBlockLayout } from "./inline-block-layout";
import type { MediaState } from "@/lib/company-media";
import type { ContentBlockType, HeadingSlot, ProfileContentBlock } from "@/lib/profile-content";
import styles from "./inline-profile.module.css";
import { normalizeBlockLayout, normalizeTextBlockLayout } from "@/lib/content-block-layout";
import { useInlineEditorHistory } from "./inline-editor-history";

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
  const history = useInlineEditorHistory();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ContentState>({});
  const [pickerBefore, setPickerBefore] = useState<string | null | undefined>();
  const [draft, setDraft] = useState<{ type: ContentBlockType; before: string | null } | null>(null);
  if (!editing) return blocks.length ? <ProfileContentBlocks blocks={blocks} /> : null;
  if (!available) return <p role="status" className={styles.contentUnavailable}>Inhaltsblöcke werden verfügbar, sobald die neue Datenbankmigration angewendet ist.</p>;

  async function run(form: FormData, onSuccess?: () => void) {
    if (busyRef.current || history.busy) return false;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    try {
      const result = await saveAction(form);
      setFeedback(result);
      if (result.success) {
        if (["insert", "duplicate", "delete"].includes(String(form.get("intent")))) history.clear();
        onSuccess?.();
        router.refresh();
      }
      return Boolean(result.success);
    } catch {
      setFeedback({ error: "Der Inhalt konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." });
      return false;
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
  async function saveBlock(intent: string, blockId: string, values: Record<string, string> = {}) {
    const form = formFor(intent, blockId);
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    const block = blocks.find((item) => item.id === blockId);
    const beforeOrder = blocks.map((item) => item.id);
    const saved = await run(form);
    if (!saved || !block) return saved;
    if (intent === "layout") {
      const before = block.type === "image_grid"
        ? normalizeBlockLayout(block.config) : normalizeTextBlockLayout(block.config);
      const width = values.width_percent === undefined ? before.width_percent : Number(values.width_percent);
      const after = {
        ...before,
        width_percent: width,
        offset_percent: values.offset_percent === undefined
          ? Math.min(before.offset_percent, 100 - width) : Number(values.offset_percent),
        spacing_top: values.spacing_top ?? before.spacing_top,
        spacing_bottom: values.spacing_bottom ?? before.spacing_bottom,
        ...(block.type !== "image_grid" ? { text_align: values.text_align ?? normalizeTextBlockLayout(block.config).text_align } : {}),
      } as typeof before;
      history.record({ kind: "layout", blockId, before, after }, saved);
    } else if (intent === "move") {
      const index = beforeOrder.indexOf(blockId);
      const other = index + (values.direction === "up" ? -1 : 1);
      if (index >= 0 && other >= 0 && other < beforeOrder.length) {
        const after = [...beforeOrder];
        [after[index], after[other]] = [after[other], after[index]];
        history.record({ kind: "block-order", before: beforeOrder, after }, saved);
      }
    }
    return saved;
  }
  function addControl(before: string | null) {
    const selected = pickerBefore === before;
    const activeDraft = draft?.before === before;
    return <div className={styles.insertArea} key={`add-${before ?? "end"}`}>
      {!activeDraft && <button type="button" className={`button ${styles.addButton}`} disabled={busy || history.busy}
        onClick={() => { setPickerBefore(selected ? undefined : before); setDraft(null); }}>
        + Inhalt hinzufügen
      </button>}
      {selected && !activeDraft && <div className={styles.blockPicker} aria-label="Inhaltstyp wählen">
        <button type="button" className="button" disabled={history.busy} onClick={() => { setDraft({ type: "heading", before }); setPickerBefore(undefined); }}>Überschrift</button>
        <button type="button" className="button" disabled={history.busy} onClick={() => { setDraft({ type: "text", before }); setPickerBefore(undefined); }}>Text</button>
        {imagesAvailable && <button type="button" className="button" disabled={busy || history.busy} onClick={() => {
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
            ? <input name="text" required maxLength={200} disabled={busy || history.busy} autoFocus />
            : <textarea name="text" required maxLength={10000} rows={5} disabled={busy || history.busy} autoFocus />}
        </label>
        <div className={styles.blockActions}>
          <button className="button button-primary" disabled={busy || history.busy}>{busy ? "Wird gespeichert …" : "Block speichern"}</button>
          <button type="button" className="button" disabled={busy || history.busy} onClick={() => setDraft(null)}>Abbrechen</button>
        </div>
      </form>}
    </div>;
  }

  return <div className={styles.contentEditor} aria-label="Profilinhalte bearbeiten">
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
    {blocks.map((block, index) => <div key={block.id}>
      {addControl(block.id)}
      <InlineBlockLayout block={block} busy={busy || history.busy} first={index === 0} last={index === blocks.length - 1}
        save={saveBlock}>
        {block.type === "image_grid" ? <InlineImageGridEditor block={block} saveAction={saveImage} />
          : <form key={`${block.id}-${block.content.text}`} className={styles.blockForm} onSubmit={(event) => {
          event.preventDefault();
          const form = formFor("update", block.id);
          form.set("text", String(new FormData(event.currentTarget).get("text") ?? ""));
          void (async () => {
            const saved = await run(form);
            history.record({ kind: "text", blockId: block.id,
              before: block.content.text, after: String(form.get("text")).trim() }, saved);
          })();
        }}>
          <label>{block.type === "heading" ? "Überschrift" : "Text"}
            {block.type === "heading"
              ? <input name="text" defaultValue={block.content.text} required maxLength={200} disabled={busy || history.busy} />
              : <textarea name="text" defaultValue={block.content.text} required maxLength={10000} rows={5} disabled={busy || history.busy} />}
          </label>
          <div className={styles.blockActions}>
            <button className="button" disabled={busy || history.busy}>{busy ? "Wird gespeichert …" : "Block speichern"}</button>
          </div>
        </form>}
      </InlineBlockLayout>
    </div>)}
    {addControl(null)}
  </div>;
}
