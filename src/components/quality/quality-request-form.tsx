"use client";
import { useActionState } from "react";
import { requestQualityVerification } from "@/app/(energieheld)/firma/quality-actions";
import type { QualityRequest } from "@/lib/company-quality-request";
import type { CompanyVerification } from "@/types/portal";
import styles from "./quality.module.css";

export function QualityRequestForm({
  review,
  request,
}: {
  review?: CompanyVerification;
  request?: QualityRequest;
}) {
  const [state, action, busy] = useActionState(requestQualityVerification, {});
  return (
    <section className={styles.admin}>
      <h2>Persönliche Verifizierung</h2>
      {review?.status === "verified" ? (
        <>
          <p className={styles.verified}>✓ Persönlich verifiziert</p>
          <p>Ihr Unternehmen ist persönlich verifiziert.</p>
        </>
      ) : request?.status === "pending" ? (
        <>
          <p>
            <strong>Verifizierung angefragt</strong>
          </p>
          <p>
            Angefragt am{" "}
            <time dateTime={request.requested_at}>
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeZone: "Europe/Berlin",
              }).format(new Date(request.requested_at))}
            </time>
          </p>
          <p>Das Energieheld-Team prüft Ihre Anfrage.</p>
        </>
      ) : (
        <>
          {request?.status === "rejected" && (
            <p>Verifizierung derzeit nicht bestätigt.</p>
          )}
          <p>
            Mit der persönlichen Verifizierung können Unternehmen sichtbar
            machen, dass sie dem Energieheld-Team persönlich bekannt sind und
            bereits positive Erfahrungen hinsichtlich Qualität, Ausführung,
            Termintreue, Kostentreue und Kommunikation vorliegen.
          </p>
          <p>
            Welche Voraussetzungen und Unterlagen erforderlich sind, wird hier
            später noch ausführlich erklärt.
          </p>
          <form action={action}>
            <button className="button" disabled={busy}>
              {busy
                ? "Wird angefragt …"
                : request
                  ? "Erneut anfragen"
                  : "Verifizierung anfragen"}
            </button>
          </form>
        </>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </section>
  );
}
