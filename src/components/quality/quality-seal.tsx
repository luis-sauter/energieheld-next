"use client";
import { useId, useRef } from "react";
import Image from "next/image";
import styles from "./quality.module.css";
export function QualitySeal({
  note,
  prominent = false,
}: {
  note?: string | null;
  prominent?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  return (
    <div className={styles.sealWrap}>
      <button
        type="button"
        className={`${styles.seal} ${prominent ? styles.prominent : ""}`}
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label="Persönlich verifiziert – Bedeutung anzeigen"
      >
        <Image
          src="/images/energieheld-verifiziert.png"
          alt="Persönlich verifiziert"
          width={305}
          height={203}
        />
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={title}>
        <div className={styles.heading}>
          <h2 id={title}>Persönlich verifiziert</h2>
          <button
            type="button"
            aria-label="Erklärung schließen"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p>
          „Persönlich verifiziert“ bedeutet, dass das Unternehmen dem
          Energieheld-Team persönlich bekannt ist und aufgrund positiver
          Erfahrungen in folgenden Bereichen empfohlen wird:
        </p>
        <ul>
          <li>Qualität</li>
          <li>vollständige Ausführung</li>
          <li>Termintreue</li>
          <li>Kostentreue</li>
          <li>Kommunikation</li>
        </ul>
        {note && (
          <div className={styles.note}>
            <strong>Öffentliche Notiz</strong>
            <p>{note}</p>
          </div>
        )}
        <p className={styles.disclaimer}>
          Die Kennzeichnung gibt den persönlichen Eindruck bzw. bisherige
          Erfahrungen wieder und ist keine Garantie für die dauerhafte
          Einhaltung dieser Kriterien.
        </p>
      </dialog>
    </div>
  );
}
