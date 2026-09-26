"use client";

import { useState, useTransition } from "react";
import type { TravelTerm } from "@/lib/admin-travel-taxonomy";
import styles from "./admin.module.css";

const groups = [
  ["theme", "Reisearten und Themen"],
  ["audience", "Reisende"],
  ["accommodation", "Unterkunftstypen"],
  ["feature", "Besonderheiten"],
] as const;

export function TravelTaxonomyEditor({ terms, assignedKeys, toggleAction }: {
  terms: TravelTerm[];
  assignedKeys: string[];
  toggleAction: (termKey: string, assign: boolean) => Promise<{ error?: string; success?: string }>;
}) {
  const [selected, setSelected] = useState(() => new Set(assignedKeys));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});

  function toggle(termKey: string) {
    const assign = !selected.has(termKey);
    setMessage({});
    startTransition(async () => {
      try {
        const result = await toggleAction(termKey, assign);
        setMessage(result);
        if (result.success) setSelected((current) => {
          const next = new Set(current);
          if (assign) next.add(termKey);
          else next.delete(termKey);
          return next;
        });
      } catch {
        setMessage({ error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." });
      }
    });
  }

  return <section aria-label="Reisezuordnungen" aria-busy={pending}>
    <h2>Reisezuordnungen</h2>
    <p>Ordnen Sie nur Merkmale zu, die für dieses Profil belegt sind.</p>
    {groups.map(([dimension, title]) => {
      const options = terms.filter((term) => term.dimension === dimension);
      return options.length > 0 && <div key={dimension} className={styles.categories}>
        <h3>{title}</h3>
        {options.map((term) => <div key={term.term_key} className={styles.actions}>
          <span>{term.label}</span>
          <button type="button" className="button" disabled={pending}
            aria-label={`${term.label} ${selected.has(term.term_key) ? "entfernen" : "zuordnen"}`}
            onClick={() => toggle(term.term_key)}>
            {selected.has(term.term_key) ? "Entfernen" : "Zuordnen"}
          </button>
        </div>)}
      </div>;
    })}
    {message.error && <p role="alert">{message.error}</p>}
    {message.success && <p role="status">{message.success}</p>}
  </section>;
}
