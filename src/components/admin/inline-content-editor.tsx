"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileEditorialContent } from "@/components/portal/profile-content-blocks";
import type { Listing } from "@/types/portal";
import { InlineImageGridEditor } from "./inline-image-grid-editor";
import { InlineBlockLayout } from "./inline-block-layout";
import { BlockImageGrid } from "@/components/portal/profile-content-blocks";
import type { MediaState } from "@/lib/company-media";
import type { ContentBlockType, EditorialItem, HeadingSlot, ProfileContentBlock } from "@/lib/profile-content";
import styles from "./inline-profile.module.css";
import { normalizeBlockLayout, normalizeTextBlockLayout, type TextAlignment } from "@/lib/content-block-layout";
import { useInlineEditorHistory } from "./inline-editor-history";
import { contentBlockRows, contentColumn } from "@/lib/content-block-rows";
import rowStyles from "@/components/portal/profile-content-blocks.module.css";
import { adjacentImageLayout, type ImageShare, type ImageSide } from "@/lib/adjacent-image-layout";
import { uploadPreparedAdminMedia } from "@/lib/admin-media-upload";
import { AdjacentImagePreview } from "./adjacent-image-preview";

type ContentState = { error?: string; success?: string; blockId?: string };
type SaveContent = (form: FormData) => Promise<ContentState>;
type AdjacentDraft = { textId: string; side: ImageSide; share: ImageShare; file?: File; previewUrl?: string };
type PairPreview = { textId: string; imageId: string; side: ImageSide; share: ImageShare };

export function SectionPartFrame({ sectionKey, part, align, missing, saveAction, children }: {
  sectionKey: string; part: "heading" | "text"; align: TextAlignment; missing: boolean;
  saveAction: SaveContent; children: React.ReactNode;
}) {
  const router = useRouter();
  const [previewAlign, setPreviewAlign] = useState(align);
  const [removed, setRemoved] = useState(missing);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ContentState>({});
  async function change(action: "align" | "delete" | "restore", nextAlign?: TextAlignment) {
    if (busy) return;
    const previous = previewAlign;
    if (nextAlign) setPreviewAlign(nextAlign);
    setBusy(true);
    setFeedback({});
    const form = new FormData();
    form.set("intent", "section-part");
    form.set("block_id", sectionKey);
    form.set("part", part);
    form.set("action", action);
    if (nextAlign) form.set("text_align", nextAlign);
    try {
      const result = await saveAction(form);
      setFeedback(result);
      if (!result.success) setPreviewAlign(previous);
      else {
        if (action === "delete") setRemoved(true);
        if (action === "restore") setRemoved(false);
        router.refresh();
      }
    } catch {
      setPreviewAlign(previous);
      setFeedback({ error: "Dieser Abschnittsteil konnte nicht gespeichert werden." });
    } finally { setBusy(false); }
  }
  const label = part === "heading" ? "Überschrift" : "Text";
  return <div className={styles.sectionPart} data-part={part} style={{ textAlign: previewAlign }}>
    <strong>{label} separat bearbeiten</strong>
    {!removed && <div className={styles.partControls} role="group" aria-label={`${label} ausrichten`}>
      {(["left", "center", "right"] as const).map((choice) => <button key={choice} type="button" className="button"
        aria-label={`${label} ${choice === "left" ? "links" : choice === "center" ? "mittig" : "rechts"}`}
        aria-pressed={previewAlign === choice} disabled={busy} onClick={() => void change("align", choice)}>
        {choice === "left" ? "Links" : choice === "center" ? "Mitte" : "Rechts"}
      </button>)}
    </div>}
    {!removed ? children : <p role="status">{label} entfernt.</p>}
    {part === "heading" || !removed ? <button type="button" className="button" disabled={busy}
      onClick={() => {
        if (removed) void change("restore");
        else if (window.confirm(`Nur ${label.toLowerCase()} aus diesem Abschnitt entfernen?`)) void change("delete");
      }}>{removed ? "Überschrift wiederherstellen" : `${label} löschen`}</button>
      : <button type="button" className="button" disabled={busy} onClick={() => setRemoved(false)}>Text wieder hinzufügen</button>}
    {feedback.error && <span role="alert" className={styles.error}>{feedback.error}</span>}
    {feedback.success && <span role="status" className={styles.success}>{feedback.success}</span>}
  </div>;
}

export function FixedHeadingEditor({ slot, sectionKey, value, defaultText, align, hidden, saveAction }: {
  slot: HeadingSlot;
  sectionKey: string;
  value: string;
  defaultText: string;
  align: TextAlignment;
  hidden: boolean;
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
  return <SectionPartFrame sectionKey={sectionKey} part="heading" align={align} missing={hidden} saveAction={saveAction}>
    <form className={styles.headingForm} onSubmit={submit}>
    <label htmlFor={`fixed-${slot}`}>
      <span>Überschrift</span>
      <input id={`fixed-${slot}`} value={text} maxLength={200} disabled={busy}
        onChange={(event) => { setText(event.target.value); setFeedback({}); }} />
    </label>
    <button className="button" disabled={busy}>{busy ? "Wird gespeichert …" : "Überschrift speichern"}</button>
    {feedback.error && <span role="alert" className={styles.error}>{feedback.error}</span>}
    {feedback.success && <span role="status" className={styles.success}>{feedback.success}</span>}
    </form>
  </SectionPartFrame>;
}

export function InlineContentEditor({ blocks, items, listing, renderSpecial, editing, available, imagesAvailable, saveAction, saveImage }: {
  blocks: ProfileContentBlock[];
  items: EditorialItem[];
  listing: Listing;
  renderSpecial: (item: EditorialItem) => React.ReactNode;
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
  const [adjacentDraft, setAdjacentDraft] = useState<AdjacentDraft | null>(null);
  const [pairPreview, setPairPreview] = useState<PairPreview | null>(null);
  const [progress, setProgress] = useState("");
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  useEffect(() => {
    if (!pairPreview) return;
    const layout = adjacentImageLayout(pairPreview.side, pairPreview.share);
    const image = blocks.find((block) => block.id === pairPreview.imageId);
    const text = blocks.find((block) => block.id === pairPreview.textId);
    const section = items.find((item) => item.key === pairPreview.textId && item.kind !== "block");
    if (layout && image && section?.imageBlock?.id === image.id &&
      normalizeBlockLayout(image.config).width_percent === layout.imageWidth &&
      normalizeBlockLayout(image.config).offset_percent === layout.imageOffset &&
      section.layout.width_percent === layout.textWidth && section.layout.offset_percent === layout.textOffset) {
      const frame = window.requestAnimationFrame(() => setPairPreview(null));
      return () => window.cancelAnimationFrame(frame);
    }
    if (layout && image && text && normalizeBlockLayout(image.config).width_percent === layout.imageWidth &&
      normalizeBlockLayout(image.config).offset_percent === layout.imageOffset &&
      normalizeBlockLayout(text.config).width_percent === layout.textWidth &&
      normalizeBlockLayout(text.config).offset_percent === layout.textOffset &&
      (items.findIndex((item) => item.key === image.id) < items.findIndex((item) => item.key === text.id)) ===
        (pairPreview.side === "left")) {
      const frame = window.requestAnimationFrame(() => setPairPreview(null));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [blocks, items, pairPreview]);
  if (!editing) return <ProfileEditorialContent items={items} listing={listing} />;
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
        if (["insert", "duplicate", "delete", "section-delete", "section-duplicate", "section-restore",
          "pair-delete", "pair-duplicate"].includes(String(form.get("intent")))) history.clear();
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
  function clearAdjacentDraft() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setAdjacentDraft(null);
  }
  async function createAdjacentImage(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjacentDraft?.file || busyRef.current || history.busy) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    const form = new FormData();
    form.set("intent", "pair-image");
    form.set("text_block_id", adjacentDraft.textId);
    form.set("image_side", adjacentDraft.side);
    form.set("image_width", String(adjacentDraft.share));
    let createdBlockId: string | undefined;
    async function removeIncompleteBlock() {
      if (!createdBlockId) return true;
      return Boolean((await saveAction(formFor("delete", createdBlockId))).success);
    }
    try {
      const created = await saveAction(form);
      if (!created.success || !created.blockId) {
        setFeedback({ error: created.error ?? "Der Bildblock konnte nicht angelegt werden." });
        return;
      }
      createdBlockId = created.blockId;
      const prepare = formFor("prepare", created.blockId);
      const finish = formFor("upload", created.blockId);
      finish.set("alt_text", "");
      const uploaded = await uploadPreparedAdminMedia(saveImage, adjacentDraft.file, prepare, finish, setProgress);
      if (!uploaded.success) {
        const removed = await removeIncompleteBlock();
        setFeedback({ error: `${uploaded.error ?? "Das Bild konnte nicht hochgeladen werden."}${removed ? "" : " Bitte entfernen Sie den unvollständigen Bildblock im Editor."}` });
        router.refresh();
        return;
      }
      const arrangement = new FormData();
      arrangement.set("intent", "pair-layout");
      arrangement.set("text_block_id", adjacentDraft.textId);
      arrangement.set("image_block_id", created.blockId);
      arrangement.set("image_side", adjacentDraft.side);
      arrangement.set("image_width", String(adjacentDraft.share));
      const arranged = await saveAction(arrangement);
      if (!arranged.success) {
        const removed = await removeIncompleteBlock();
        setFeedback({ error: `${arranged.error ?? "Text und Bild konnten nicht angeordnet werden."}${removed ? "" : " Bitte entfernen Sie den Bildblock im Editor."}` });
        router.refresh();
        return;
      }
      history.clear();
      setFeedback({ success: "Bild und Text stehen jetzt nebeneinander." });
      clearAdjacentDraft();
      router.refresh();
    } catch {
      try { await removeIncompleteBlock(); } catch { /* A failed cleanup remains scoped to this profile. */ }
      setFeedback({ error: "Das Bild konnte nicht hinzugefügt werden. Bitte versuchen Sie es erneut." });
      router.refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  async function saveBlock(intent: string, blockId: string, values: Record<string, string> = {}) {
    const form = formFor(intent, blockId);
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    const block = blocks.find((item) => item.id === blockId);
    const beforeOrder = items.map((item) => item.key);
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
        {!items.some((item) => item.kind === "about") && <button type="button" className="button" disabled={busy || history.busy}
          onClick={() => void run(formFor("section-restore", "section:about"), () => setPickerBefore(undefined))}>Beschreibung wieder hinzufügen</button>}
        {!items.some((item) => item.kind === "business") && <button type="button" className="button" disabled={busy || history.busy}
          onClick={() => void run(formFor("section-restore", "section:business"), () => setPickerBefore(undefined))}>Tätigkeitsbereiche wieder hinzufügen</button>}
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

  function renderEditableBlock(block: ProfileContentBlock, paired = false) {
    const index = items.findIndex((item) => item.key === block.id);
    return <div key={block.id}>
      {!paired && addControl(block.id)}
      <InlineBlockLayout block={block} busy={busy || history.busy} first={index === 0} last={index === items.length - 1}
        save={saveBlock} sectionHidden={items[index]?.hidden} pairedPart={paired}>
        {items[index]?.hidden && <p role="status">Dieser Block ist öffentlich ausgeblendet.</p>}
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
        {block.type === "text" && renderAdjacentAction(block.id, block.content.text, paired)}
      </InlineBlockLayout>
    </div>;
  }

  function renderPairedImage(block: ProfileContentBlock) {
    return <div key={block.id} className={styles.pairedImageEditor}>
      {block.images?.length ? <BlockImageGrid block={block} /> : <p>Bild auswählen und hochladen.</p>}
      <details className={styles.pairedImageTools} open={!block.images?.length}>
        <summary>Bild bearbeiten · Ausschnitt, Ersetzen und Beschreibung</summary>
        <InlineImageGridEditor block={block} saveAction={saveImage} />
      </details>
      <button type="button" className="button" disabled={busy || history.busy}
        onClick={() => { if (window.confirm("Bild neben diesem Abschnitt wirklich entfernen?"))
          void saveBlock("delete", block.id); }}>Bild daneben entfernen</button>
    </div>;
  }

  function renderAdjacentAction(textId: string, text: string, paired = false) {
    return imagesAvailable && !paired && <div className={styles.adjacentAction}>
          {adjacentDraft?.textId !== textId && <button type="button" className="button" disabled={busy || history.busy}
            onClick={() => { clearAdjacentDraft(); setAdjacentDraft({ textId, side: "right", share: 50 }); }}>Bild daneben hinzufügen</button>}
          {adjacentDraft?.textId === textId && <form className={styles.adjacentSetup} onSubmit={createAdjacentImage}>
            <strong>Bild neben diesem Text</strong>
            <label>Bild auswählen
              <input type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy}
                onChange={(event) => {
                  if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
                  const file = event.target.files?.[0];
                  previewUrl.current = file ? URL.createObjectURL(file) : null;
                  setAdjacentDraft((current) => current ? { ...current, file, previewUrl: previewUrl.current ?? undefined } : null);
                }} />
            </label>
            <div className={styles.adjacentOptions} role="group" aria-label="Bildposition">
              <span>Bildposition</span>
              {(["left", "right"] as const).map((side) => <button key={side} type="button" className="button"
                aria-pressed={adjacentDraft.side === side} disabled={busy}
                onClick={() => setAdjacentDraft((current) => current ? { ...current, side } : null)}>
                Bild {side === "left" ? "links" : "rechts"}
              </button>)}
            </div>
            <div className={styles.adjacentOptions} role="group" aria-label="Breitenverhältnis">
              <span>Bild / Text</span>
              {([25, 50, 75] as const).map((share) => <button key={share} type="button" className="button"
                aria-pressed={adjacentDraft.share === share} disabled={busy}
                onClick={() => setAdjacentDraft((current) => current ? { ...current, share } : null)}>
                {share} / {100 - share}
              </button>)}
            </div>
            <AdjacentImagePreview text={text} side={adjacentDraft.side}
              share={adjacentDraft.share} previewUrl={adjacentDraft.previewUrl} />
            <div className={styles.blockActions}>
              <button className="button button-primary" disabled={busy || !adjacentDraft.file}>{busy ? "Wird hinzugefügt …" : "Bild und Text anordnen"}</button>
              <button type="button" className="button" disabled={busy} onClick={clearAdjacentDraft}>Abbrechen</button>
            </div>
          </form>}
        </div>;
  }

  function renderNormalRun(runBlocks: ProfileContentBlock[]) {
    let displayed = runBlocks;
    if (pairPreview) {
      const layout = adjacentImageLayout(pairPreview.side, pairPreview.share);
      const textAt = runBlocks.findIndex((block) => block.id === pairPreview.textId);
      const image = runBlocks.find((block) => block.id === pairPreview.imageId);
      if (layout && textAt >= 0 && image) {
        const heading = runBlocks[textAt - 1]?.type === "heading" &&
          normalizeBlockLayout(runBlocks[textAt - 1].config).width_percent === normalizeBlockLayout(runBlocks[textAt].config).width_percent &&
          normalizeBlockLayout(runBlocks[textAt - 1].config).offset_percent === normalizeBlockLayout(runBlocks[textAt].config).offset_percent
          ? runBlocks[textAt - 1] : null;
        displayed = runBlocks.filter((block) => block.id !== image.id).map((block) => {
          const position = block.id === image.id ? { width_percent: layout.imageWidth, offset_percent: layout.imageOffset }
            : block.id === pairPreview.textId || block.id === heading?.id
              ? { width_percent: layout.textWidth, offset_percent: layout.textOffset } : null;
          return position ? { ...block, config: { ...block.config, ...position } } : block;
        });
        const imagePreview = { ...image, config: { ...image.config,
          width_percent: layout.imageWidth, offset_percent: layout.imageOffset } };
        const target = displayed.findIndex((block) => block.id === (pairPreview.side === "left" ? heading?.id ?? pairPreview.textId : pairPreview.textId));
        displayed.splice(pairPreview.side === "left" ? target : target + 1, 0, imagePreview);
      }
    }
    return contentBlockRows(displayed).map((row) => {
      if (!row.right) return row.left.map((block) => renderEditableBlock(block));
      const columns = [row.left, row.right];
      const image = columns.flat().find((block) => block.type === "image_grid");
      const text = columns.flat().find((block) => block.type === "text");
      const imageLayout = image ? normalizeBlockLayout(image.config) : null;
      const textLayout = text ? normalizeBlockLayout(text.config) : null;
      const side = imageLayout && textLayout && imageLayout.offset_percent < textLayout.offset_percent ? "left" : "right";
      const share = imageLayout && ([25, 50, 75] as number[]).includes(imageLayout.width_percent)
        ? imageLayout.width_percent as ImageShare : 50;
      const pairContent = <>
        {image && text && imageLayout && <div className={styles.pairControls} aria-label="Text und Bild anordnen">
          <strong>Text + Bild nebeneinander</strong>
          <div className={styles.adjacentOptions} role="group" aria-label="Bildposition">
            {(["left", "right"] as const).map((choice) => <button key={choice} type="button" className="button"
              aria-pressed={side === choice} disabled={busy || history.busy}
              onClick={() => void setPairLayout(text.id, image.id, choice, share)}>
              Bild {choice === "left" ? "links" : "rechts"}</button>)}
          </div>
          <div className={styles.adjacentOptions} role="group" aria-label="Breitenverhältnis">
            {([25, 50, 75] as const).map((share) => <button key={share} type="button" className="button"
              aria-pressed={imageLayout.width_percent === share} disabled={busy || history.busy}
              onClick={() => void setPairLayout(text.id, image.id, side, share)}>{share} % Bild / {100 - share} % Text</button>)}
          </div>
        </div>}
        <div className={rowStyles.contentRow}>
          {columns.map((column) => <div className={`${rowStyles.contentColumn} ${styles.pairedEditorColumn}`}
            key={column[0].id} style={{ gridColumn: contentColumn(column[0]) }}>
            {column.map((block) => block.type === "image_grid" ? renderPairedImage(block) : renderEditableBlock(block, true))}
          </div>)}
        </div>
      </>;
      if (!image || !text) return <div key={row.left[0].id}>{pairContent}</div>;
      const pairMembers = columns.flat();
      const indices = pairMembers.map((block) => items.findIndex((item) => item.key === block.id));
      const pairBlock: ProfileContentBlock = { ...text, id: `pair:${text.id}:${image.id}`,
        config: normalizeTextBlockLayout({ width_percent: 100, offset_percent: 0,
          text_align: normalizeTextBlockLayout(text.config).text_align, ...text.pair_layout }) };
      async function savePair(intent: string, _blockId: string, values: Record<string, string> = {}) {
        const form = new FormData();
        form.set("intent", ({ layout: "pair-frame", move: "pair-move", duplicate: "pair-duplicate",
          "block-toggle": "pair-toggle", delete: "pair-delete" } as Record<string, string>)[intent] ?? intent);
        form.set("text_block_id", text!.id);
        form.set("image_block_id", image!.id);
        for (const [key, value] of Object.entries(values)) form.set(key, value);
        return run(form);
      }
      return <InlineBlockLayout key={row.left[0].id} block={pairBlock} save={savePair}
        busy={busy || history.busy} first={Math.min(...indices) === 0} last={Math.max(...indices) === items.length - 1}
        sectionHidden={pairMembers.every((block) => items.find((item) => item.key === block.id)?.hidden)}>
        {pairContent}
      </InlineBlockLayout>;
    });
  }

  async function setPairLayout(textId: string, imageId: string, side: ImageSide, share: ImageShare) {
    setPairPreview({ textId, imageId, side, share });
    const form = new FormData();
    form.set("intent", "pair-layout");
    form.set("text_block_id", textId);
    form.set("image_block_id", imageId);
    form.set("image_side", side);
    form.set("image_width", String(share));
    if (await run(form)) history.clear();
    else setPairPreview(null);
  }

  const editorial: React.ReactNode[] = [];
  let pendingBlocks: ProfileContentBlock[] = [];
  function flush() { if (pendingBlocks.length) editorial.push(...renderNormalRun(pendingBlocks)); pendingBlocks = []; }
  for (const item of items) {
    if (item.kind === "block") { if (item.block) pendingBlocks.push(item.block); continue; }
    flush();
    const synthetic: ProfileContentBlock = { id: item.key, profile_id: listing.id, type: "heading", slot: null,
      sort_order: 0, content: { text: item.heading }, config: item.imageBlock ? item.pairLayout : item.layout };
    const index = items.indexOf(item);
    const specialImage = item.imageBlock;
    const preview = specialImage && pairPreview?.textId === item.key && pairPreview.imageId === specialImage.id
      ? adjacentImageLayout(pairPreview.side, pairPreview.share) : null;
    const imageLayout = specialImage ? normalizeBlockLayout(specialImage.config) : null;
    const textLayout = preview ? { ...item.layout, width_percent: preview.textWidth, offset_percent: preview.textOffset } : item.layout;
    const shownImage = specialImage && preview ? { ...specialImage, config: { ...specialImage.config,
      width_percent: preview.imageWidth, offset_percent: preview.imageOffset } } : specialImage;
    const side = imageLayout && imageLayout.offset_percent < item.layout.offset_percent ? "left" : "right";
    const share = imageLayout && ([25, 50, 75] as number[]).includes(imageLayout.width_percent)
      ? imageLayout.width_percent as ImageShare : 50;
    async function saveSpecial(intent: string, blockId: string, values: Record<string, string> = {}) {
      if (intent !== "layout" || !specialImage) return saveBlock(intent, blockId, values);
      const form = formFor("section-pair-frame", blockId);
      for (const [key, value] of Object.entries(values)) form.set(key, value);
      return run(form);
    }
    editorial.push(<InlineBlockLayout key={item.key} block={synthetic} sectionHidden={item.hidden}
      sectionLabel={item.kind === "about" ? "Beschreibung" : "Tätigkeitsbereiche"}
      busy={busy || history.busy} first={index === 0} last={index === items.length - 1} save={saveSpecial}>
      {item.hidden && <p role="status">Dieser Abschnitt ist öffentlich ausgeblendet.</p>}
      {specialImage && <div className={styles.pairControls} aria-label="Abschnitt und Bild anordnen">
        <strong>Text + Bild nebeneinander</strong>
        <div className={styles.adjacentOptions} role="group" aria-label="Bildposition">
          {(["left", "right"] as const).map((choice) => <button key={choice} type="button" className="button"
            aria-pressed={(preview?.side ?? side) === choice} disabled={busy || history.busy}
            onClick={() => void setPairLayout(item.key, specialImage.id, choice, (preview?.imageWidth ?? share) as ImageShare)}>
            Bild {choice === "left" ? "links" : "rechts"}</button>)}
        </div>
        <div className={styles.adjacentOptions} role="group" aria-label="Breitenverhältnis">
          {([25, 50, 75] as const).map((choice) => <button key={choice} type="button" className="button"
            aria-pressed={(preview?.imageWidth ?? imageLayout?.width_percent) === choice} disabled={busy || history.busy}
            onClick={() => void setPairLayout(item.key, specialImage.id, (preview?.side ?? side) as ImageSide, choice)}>
            {choice} % Bild / {100 - choice} % Text</button>)}
        </div>
      </div>}
      {shownImage ? <div className={rowStyles.contentRow}>
        <div className={`${rowStyles.contentColumn} ${styles.pairedEditorColumn}`}
          style={{ gridColumn: `${textLayout.offset_percent + 1} / span ${textLayout.width_percent}` }}>
          {renderSpecial(item)}
        </div>
        <div className={`${rowStyles.contentColumn} ${styles.pairedEditorColumn}`}
          style={{ gridColumn: contentColumn(shownImage) }}>
          {renderPairedImage(shownImage)}
        </div>
      </div> : <>{renderSpecial(item)}{renderAdjacentAction(item.key,
        item.kind === "about" ? listing.description ?? "" : listing.businessAreas ?? "")}</>}
    </InlineBlockLayout>);
  }
  flush();

  return <div className={styles.contentEditor} aria-label="Profilinhalte bearbeiten">
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
    {progress && <p role="status">{progress}</p>}
    {editorial}
    {addControl(null)}
  </div>;
}
