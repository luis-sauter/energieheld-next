"use client";
import Link from "next/link";
import { useActionState } from "react";
import { submitFirstPublication } from "@/app/(energieheld)/firma/profil/gestalten/actions";
export function CompanyPublication({
  status,
  slug,
}: {
  status: string;
  slug: string;
}) {
  const [state, action, pending] = useActionState(submitFirstPublication, {});
  return (
    <section className="profile-publication">
      {status === "approved" ? (
        <>
          <h2>Ihr Profil ist veröffentlicht</h2>
          <p>
            Änderungen an Texten, Logo und Bildern werden direkt übernommen. Die
            offiziellen Gewerke verwaltet Energieheld.
          </p>
          <Link className="button button-primary" href={`/experten/${slug}`}>
            Öffentliches Profil ansehen
          </Link>
        </>
      ) : status === "pending" ? (
        <>
          <h2>Erstfreischaltung angefragt</h2>
          <p>
            Energieheld ordnet die offiziellen Gewerke zu und schaltet Ihr
            Profil anschließend frei. Sie können Ihr Profil weiter gestalten.
          </p>
        </>
      ) : (
        <>
          <h2>Bereit für Ihr öffentliches Profil?</h2>
          <p>
            Die offizielle Zuordnung zu Gewerken erfolgt durch Energieheld.
            Dafür ist einmalig eine Freischaltung nötig. Spätere Text- und
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
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </section>
  );
}
