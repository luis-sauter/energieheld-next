"use client";

import { useRef, useState } from "react";
import { BlockImageGrid } from "@/components/portal/profile-content-blocks";
import type { ProfileContentBlock } from "@/lib/profile-content";
import type { MediaState } from "@/lib/company-media";
import { InlineImageGridEditor } from "./inline-image-grid-editor";
import { useMediaLibrary } from "./media-library-context";
import styles from "./inline-profile.module.css";

export function PairedImageEditor({ block, saveImage, busy, onRemove }: {
  block: ProfileContentBlock; saveImage: (form: FormData) => Promise<MediaState>;
  busy: boolean; onRemove: (intent: string, blockId: string) => Promise<boolean>;
}) {
  const library = useMediaLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const saving = useRef(false);
  const [opened, setOpened] = useState(false);
  const [secondImage, setSecondImage] = useState(false);
  const [pending, setPending] = useState(false);
  function onBusyChange(value: boolean) {
    saving.current = value; setPending(value);
  }
  function close() { if (!saving.current) dialog.current?.close(); }
  return <div className={styles.pairedImageEditor}>
    {block.images?.length ? <BlockImageGrid block={block} editorial /> : <p>Bild auswählen und hochladen.</p>}
    <div className={styles.imageTileActions}>
      <button ref={trigger} type="button" className="button" disabled={busy} onClick={event => {
        returnFocus.current = event.currentTarget;
        if (library && !block.images?.length) { library.open({kind:"block",blockId:block.id}); return; }
        setSecondImage(false); setOpened(true); dialog.current?.showModal();
      }}>{block.images?.length ? "Bild bearbeiten" : "Bild hinzufügen"}</button>
      {Boolean(block.images?.length) && <button type="button" className="button" disabled={busy} onClick={event => {
        returnFocus.current = event.currentTarget;
        setSecondImage(true); setOpened(true); dialog.current?.showModal();
      }}>{(block.images?.length ?? 0) > 1 ? "Zweites Bild bearbeiten" : "Zweites Bild hinzufügen"}</button>}
      <details className={styles.imageMenu}><summary aria-label="Weitere Bildaktionen">⋯</summary>
      <button type="button" className="button" disabled={busy} onClick={() => {
        if (window.confirm("Bild neben diesem Abschnitt wirklich entfernen?")) void onRemove("delete", block.id);
      }}>Bild daneben entfernen</button>
      </details>
    </div>
    <dialog ref={dialog} className={styles.imageDialog} aria-labelledby={`image-tools-${block.id}`}
      onCancel={(event) => { if (event.target !== event.currentTarget) return; if (saving.current) event.preventDefault(); }}
      onClose={event => { if (event.target !== event.currentTarget) return; setOpened(false); (returnFocus.current ?? trigger.current)?.focus(); }}>
      <header className={styles.imageDialogHeader}>
        <h2 id={`image-tools-${block.id}`}>Bild bearbeiten</h2>
        <button type="button" className="button" disabled={pending} onClick={close} autoFocus>Schließen</button>
      </header>
      {opened && <InlineImageGridEditor block={block} saveAction={saveImage} onBusyChange={onBusyChange} editorial secondImage={secondImage} />}
    </dialog>
  </div>;
}
