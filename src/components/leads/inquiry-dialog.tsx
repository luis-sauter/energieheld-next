"use client";
import { useActionState, useRef } from "react";
import { sendInquiry } from "@/app/(energieheld)/experten/actions";
import type { LeadState } from "@/lib/company-leads";
import styles from "./leads.module.css";
export function InquiryDialog({
  profileId,
  companyName,
}: {
  profileId: string;
  companyName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<LeadState, FormData>(
    async (previous, form) => {
      const result = await sendInquiry(profileId, previous, form);
      if (result.success) formRef.current?.reset();
      return result;
    },
    {},
  );
  return (
    <>
      <button
        className="button button-primary"
        onClick={() => dialog.current?.showModal()}
      >
        Kontakt aufnehmen
      </button>
      <dialog
        className={styles.dialog}
        ref={dialog}
        aria-labelledby="inquiry-title"
      >
        <div className={styles.heading}>
          <h2 id="inquiry-title">Anfrage an {companyName}</h2>
          <button
            type="button"
            aria-label="Dialog schließen"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p>
          Beschreiben Sie kurz Ihr Anliegen. Ihre Angaben werden im Postfach
          dieses Unternehmens gespeichert.
        </p>
        <form ref={formRef} action={action}>
          <label>
            Name *
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={120}
              disabled={pending}
            />
          </label>
          <label>
            E-Mail *
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={pending}
            />
          </label>
          <label>
            Telefon
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={50}
              disabled={pending}
            />
          </label>
          <label>
            Nachricht *
            <textarea
              name="message"
              required
              maxLength={5000}
              rows={5}
              disabled={pending}
            />
          </label>
          <div className={styles.honeypot} aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className={styles.consent}>
            <input name="consent" type="checkbox" required disabled={pending} />{" "}
            <span>
              Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung
              meiner Anfrage an dieses Unternehmen übermittelt werden.
            </span>
          </label>
          {state.error && (
            <p role="alert" className={styles.error}>
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className={styles.success}>
              {state.success}
            </p>
          )}
          <button className="button button-primary" disabled={pending}>
            {pending ? "Wird gesendet …" : "Anfrage senden"}
          </button>
        </form>
      </dialog>
    </>
  );
}
