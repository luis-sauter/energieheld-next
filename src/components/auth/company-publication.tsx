"use client";
import Link from "next/link";
import { useActionState } from "react";
import { submitFirstPublication } from "@/app/(energieheld)/firma/profil/gestalten/actions";

export function CompanyPublication({ status }: { status: string }) {
  const [state, action, pending] = useActionState(submitFirstPublication, {});
  if (status === "approved") return null;
  if (status === "pending" || state.submitted) return <section id="freischaltung" className="profile-publication" aria-labelledby="submission-title">
    <h2 id="submission-title">Ihr Profil wurde zur Prüfung eingereicht</h2>
    <p>Danke! Ihre Angaben und Bilder sind bei unserer Redaktion eingegangen.</p>
    <p>Wir prüfen Ihre Einreichung und gestalten daraus Ihren Auftritt auf DAS Reiseportal.</p>
    <p>Falls wir noch Informationen benötigen, erhalten Sie eine Rückmeldung in Ihrem Firmenbereich.</p>
    <p role="status"><strong>Wartet auf redaktionelle Prüfung</strong></p>
    <Link className="button" href="/firma">Zurück zum Firmenbereich</Link>
  </section>;
  return <section id="freischaltung" className="profile-publication">
    <h2>Bereit für die redaktionelle Prüfung?</h2>
    <p>Wenn Sie Ihre Angaben und Bilder ergänzt haben, senden Sie Ihr Profil an unsere Redaktion. Wir prüfen Ihre Einreichung vor der ersten Veröffentlichung.</p>
    <form action={action} aria-busy={pending}>
      <button className="button button-primary" disabled={pending}>{pending ? "Wird eingereicht …" : "Profil zur Prüfung einreichen"}</button>
    </form>
    {state.error && <p role="alert">{state.error}</p>}
  </section>;
}
