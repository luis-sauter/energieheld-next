"use client";
import { useActionState } from "react";
import { submitFirstPublication } from "@/app/(energieheld)/firma/profil/gestalten/actions";
export function CompanyPublication({ status }: { status: string }) {
  const [state, action, pending] = useActionState(submitFirstPublication, {});
  if (status === "approved" || status === "pending") return null;
  return (
    <section className="profile-publication">
      <>
        <h2>Bereit für Ihr öffentliches Profil?</h2>
        <p>
          Für die erste Veröffentlichung ist eine Freischaltung nötig. Spätere Text- und
          Medienänderungen benötigen keine erneute Freigabe.
        </p>
        <form action={action}>
          <button className="button button-primary" disabled={pending}>
            {pending
              ? "Wird eingereicht …"
              : "Profil zur erstmaligen Freischaltung einreichen"}
          </button>
        </form>
      </>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </section>
  );
}
