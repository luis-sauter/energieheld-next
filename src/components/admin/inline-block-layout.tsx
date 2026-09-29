"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { ProfileContentBlock } from "@/lib/profile-content";
import { blockPositionOffset, dragBlockOffset, hasPersistedBlockLayout,
  normalizeBlockLayout, normalizeTextBlockLayout, type BlockSpacing, type TextAlignment } from "@/lib/content-block-layout";
import styles from "./inline-profile.module.css";

export function InlineBlockLayout({ block, busy, first, last, save, children, sectionHidden, sectionLabel }: {
  block: ProfileContentBlock; busy: boolean; first: boolean; last: boolean;
  save: (intent: string, blockId: string, values?: Record<string, string>) => Promise<boolean>;
  children: ReactNode; sectionHidden?: boolean; sectionLabel?: string;
}) {
  const special = block.id.startsWith("section:");
  const pair = block.id.startsWith("pair:");
  const layout = normalizeBlockLayout(block.config);
  const persisted = hasPersistedBlockLayout(block.config);
  const textAlign = normalizeTextBlockLayout(block.config).text_align;
  const [preview, setPreview] = useState({ width: layout.width_percent, offset: layout.offset_percent });
  const [textOverride, setTextOverride] = useState<{ base: TextAlignment; value: TextAlignment } | null>(null);
  const [spacingOverride, setSpacingOverride] = useState<{
    baseTop: BlockSpacing; baseBottom: BlockSpacing; top: BlockSpacing; bottom: BlockSpacing;
  } | null>(null);
  const previewTextAlign = textOverride?.base === textAlign ? textOverride.value : textAlign;
  const previewSpacing = spacingOverride?.baseTop === layout.spacing_top && spacingOverride.baseBottom === layout.spacing_bottom
    ? spacingOverride : { top: layout.spacing_top, bottom: layout.spacing_bottom };
  const current = useRef(preview);
  const drag = useRef<{ pointerId: number; x: number; width: number; offset: number; canvasWidth: number } | null>(null);
  const resize = useRef<{ pointerId: number; x: number; width: number; offset: number; canvasWidth: number } | null>(null);
  const [snap, setSnap] = useState<string | null>(null);
  useEffect(() => {
    if (drag.current) return;
    const next = { width: layout.width_percent, offset: layout.offset_percent };
    current.current = next;
    setPreview(next);
  }, [layout.width_percent, layout.offset_percent]);
  function show(width: number, offset: number) {
    const next = { width, offset };
    current.current = next;
    setPreview(next);
  }
  async function setLayout(values: Record<string, string>, width?: number, offset?: number) {
    if (width !== undefined && offset !== undefined) show(width, offset);
    if (values.text_align) setTextOverride({ base: textAlign, value: values.text_align as TextAlignment });
    if (values.spacing_top || values.spacing_bottom) setSpacingOverride({
      baseTop: layout.spacing_top, baseBottom: layout.spacing_bottom,
      top: (values.spacing_top as BlockSpacing) ?? previewSpacing.top,
      bottom: (values.spacing_bottom as BlockSpacing) ?? previewSpacing.bottom,
    });
    const ok = await save("layout", block.id, values);
    if (!ok) {
      show(layout.width_percent, layout.offset_percent);
      setTextOverride(null);
      setSpacingOverride(null);
    }
  }
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (busy || !persisted || event.pointerType === "mouse" && event.button !== 0) return;
    const canvasWidth = event.currentTarget.closest(".profile-content-canvas")?.getBoundingClientRect().width ?? 0;
    if (!canvasWidth) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX,
      width: current.current.width, offset: current.current.offset, canvasWidth };
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const result = dragBlockOffset(start.offset, start.width, event.clientX - start.x, start.canvasWidth);
    show(start.width, result.offset);
    setSnap(result.snap);
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (!cancel) move(event);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setSnap(null);
    if (cancel) show(start.width, start.offset);
    else if (current.current.offset !== start.offset)
      void setLayout({ offset_percent: String(current.current.offset) });
  }
  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (busy || !persisted || event.pointerType === "mouse" && event.button !== 0) return;
    const canvasWidth = event.currentTarget.closest(".profile-content-canvas")?.getBoundingClientRect().width ?? 0;
    if (!canvasWidth) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = { pointerId: event.pointerId, x: event.clientX,
      width: current.current.width, offset: current.current.offset, canvasWidth };
  }
  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const start = resize.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const width = Math.max(25, Math.min(100 - start.offset,
      Math.round(start.width + (event.clientX - start.x) / start.canvasWidth * 100)));
    show(width, start.offset);
  }
  function finishResize(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const start = resize.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (!cancel) moveResize(event);
    resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancel) show(start.width, start.offset);
    else if (current.current.width !== start.width)
      void setLayout({ width_percent: String(current.current.width) });
  }
  const positions: { value: TextAlignment; label: string }[] = [
    { value: "left", label: "Links" }, { value: "center", label: "Mitte" }, { value: "right", label: "Rechts" },
  ];
  const spacings: { value: BlockSpacing; label: string }[] = [
    { value: "small", label: "klein" }, { value: "normal", label: "normal" }, { value: "large", label: "groß" },
  ];
  return <div className={styles.layoutBlock} data-pair={pair || undefined}>
    <div className={styles.blockToolbar} aria-label="Block bearbeiten">
      <strong className={styles.blockType}>Blocktyp: {pair ? "Text + Bild" : special ? sectionLabel ?? "Redaktioneller Abschnitt" : block.type === "heading" ? "Überschrift" : block.type === "text" ? "Text" : "Bild"}</strong>
      <button type="button" className={styles.moveGrip} aria-label="Block horizontal ziehen"
        title={preview.width === 100 ? "Bei 100 % Breite ist keine horizontale Bewegung möglich." : "Block horizontal ziehen"}
        disabled={busy || !persisted || preview.width === 100}
        onPointerDown={start} onPointerMove={move}
        onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}>↔</button>
      <div className={styles.controlGroup} role="group" aria-label="Breite">
        <span>Breite</span>
        {[25, 50, 75, 100].map((width) => <button key={width} type="button" className="button"
          aria-label={`Breite ${width} %`} aria-pressed={preview.width === width} disabled={busy || !persisted}
          onClick={() => { const offset = Math.min(preview.offset, 100 - width);
            void setLayout({ width_percent: String(width), offset_percent: String(offset) }, width, offset); }}>
          {width} %
        </button>)}
      </div>
      <div className={styles.controlGroup} role="group" aria-label="Blockposition">
        {positions.map(({ value, label }) => <button key={value} type="button" className="button"
          aria-label={`Block ${label}`} aria-pressed={preview.width === 100 ? value === "left" : preview.offset === blockPositionOffset(preview.width, value)}
          title={preview.width === 100 && value !== "left" ? "Zuerst Blockbreite verkleinern." : undefined}
          disabled={busy || !persisted || preview.width === 100 && value !== "left"}
          onClick={() => { const offset = blockPositionOffset(preview.width, value);
            void setLayout({ offset_percent: String(offset) }, preview.width, offset); }}>{label}</button>)}
      </div>
      {!special && block.type !== "image_grid" && <div className={styles.controlGroup} role="group" aria-label="Textausrichtung">
        {positions.map(({ value, label }) => <button key={value} type="button" className="button"
          aria-label={`Text ${label === "Mitte" ? "mittig" : label.toLowerCase()}`}
          aria-pressed={previewTextAlign === value} disabled={busy || !persisted}
          onClick={() => void setLayout({ text_align: value })}>Text {label === "Mitte" ? "mittig" : label.toLowerCase()}</button>)}
      </div>}
      <details className={styles.spacingControls}><summary>Abstand</summary>
        {(["spacing_top", "spacing_bottom"] as const).map((field) => <div key={field} className={styles.controlGroup}
          role="group" aria-label={field === "spacing_top" ? "Abstand oben" : "Abstand unten"}>
          <span>{field === "spacing_top" ? "Oben" : "Unten"}</span>
          {spacings.map(({ value, label }) => <button key={value} type="button" className="button"
            aria-label={`Abstand ${field === "spacing_top" ? "oben" : "unten"} ${label}`}
            aria-pressed={(field === "spacing_top" ? previewSpacing.top : previewSpacing.bottom) === value} disabled={busy || !persisted}
            onClick={() => void setLayout({ [field]: value })}>{label}</button>)}
        </div>)}
      </details>
      <div className={styles.controlGroup} role="group" aria-label="Blockaktionen">
        <button type="button" className="button" aria-label="Block nach oben verschieben" disabled={busy || first}
          onClick={() => void save("move", block.id, { direction: "up" })}>↑</button>
        <button type="button" className="button" aria-label="Block nach unten verschieben" disabled={busy || last}
          onClick={() => void save("move", block.id, { direction: "down" })}>↓</button>
        <button type="button" className="button" disabled={busy || !persisted}
          onClick={() => void save(special ? "section-duplicate" : "duplicate", block.id)}>Duplizieren</button>
        <button type="button" className="button" disabled={busy}
          onClick={() => void save(special ? "section-toggle" : "block-toggle", block.id)}>
          {sectionHidden ? "Abschnitt einblenden" : "Abschnitt ausblenden"}</button>
        <button type="button" className={`button ${styles.destructiveAction}`} disabled={busy} onClick={() => {
          if (window.confirm("Diesen Abschnitt wirklich löschen? Der Inhalt wird dauerhaft entfernt."))
            void save(special ? "section-delete" : "delete", block.id);
        }}>Abschnitt löschen</button>
      </div>
      {!persisted && <span role="status">Layoutsteuerung nach Datenbankaktualisierung verfügbar.</span>}
      {snap && <span role="status">{snap === "center" ? "Mitte" : snap === "left" ? "Links" : "Rechts"}</span>}
    </div>
    <section className={`detail-section profile-content-block ${styles.editableBlock}`}
      data-spacing-top={previewSpacing.top} data-spacing-bottom={previewSpacing.bottom}
      data-hidden={sectionHidden || undefined}
      style={{ width: `${preview.width}%`, marginLeft: `${preview.offset}%`,
        textAlign: block.type === "image_grid" ? undefined : previewTextAlign }}>
      {children}
      {persisted && <button type="button" className={styles.blockResizeGrip} aria-label="Blockbreite durch Ziehen ändern"
        title="Blockbreite ändern" disabled={busy}
        onPointerDown={startResize} onPointerMove={moveResize}
        onPointerUp={(event) => finishResize(event)} onPointerCancel={(event) => finishResize(event, true)}>↔</button>}
    </section>
  </div>;
}
