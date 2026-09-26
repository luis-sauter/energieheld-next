"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "./icon";

export function DirectoryFilterSubmit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="button button-primary" disabled={pending} aria-busy={pending}>
    {pending ? "Suche läuft …" : "Ergebnisse anzeigen"} <Icon name="search" size={18} />
  </button>;
}
