"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "@/app/(energieheld)/firma/profil/actions";
import type { ProfileValues } from "@/lib/company-profile";
import styles from "./auth.module.css";

const fields: {
  name: keyof ProfileValues;
  label: string;
  type?: string;
  multiline?: boolean;
  autoComplete?: string;
}[] = [
  {
    name: "display_name",
    label: "Öffentlicher Profilname",
    autoComplete: "organization",
  },
  { name: "tagline", label: "Kurzbeschreibung" },
  { name: "description", label: "Beschreibung", multiline: true },
  {
    name: "business_areas",
    label: "Branchen / Tätigkeitsbereiche",
    multiline: true,
  },
  { name: "phone", label: "Telefon", type: "tel", autoComplete: "tel" },
  {
    name: "public_email",
    label: "Öffentliche E-Mail",
    type: "email",
    autoComplete: "email",
  },
  { name: "website", label: "Website", type: "url", autoComplete: "url" },
  { name: "street", label: "Straße", autoComplete: "street-address" },
  { name: "postal_code", label: "PLZ", autoComplete: "postal-code" },
  { name: "city", label: "Ort", autoComplete: "address-level2" },
  { name: "region", label: "Region", autoComplete: "address-level1" },
];

export function CompanyProfileForm({
  initialValues,
}: {
  initialValues: ProfileValues;
}) {
  const [values, setValues] = useState(initialValues);
  const [state, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      {fields.map(({ name, label, type, multiline, autoComplete }) => (
        <label key={name} className={styles.field} htmlFor={name}>
          {label}
          {name === "display_name" ? " (Pflichtfeld)" : ""}
          {multiline ? (
            <textarea
              id={name}
              name={name}
              rows={6}
              aria-describedby={
                name === "business_areas" ? "business-areas-help" : undefined
              }
              placeholder={
                name === "business_areas"
                  ? "z. B. Wärmedämmung, WDVS, Fassadensanierung, Dachbodendämmung"
                  : undefined
              }
              value={values[name]}
              disabled={pending}
              onChange={(event) =>
                setValues({ ...values, [name]: event.target.value })
              }
            />
          ) : (
            <input
              id={name}
              name={name}
              type={type ?? "text"}
              autoComplete={autoComplete}
              value={values[name]}
              required={name === "display_name"}
              disabled={pending}
              inputMode={name === "postal_code" ? "numeric" : undefined}
              pattern={name === "postal_code" ? "[0-9]{4,5}" : undefined}
              onChange={(event) =>
                setValues({ ...values, [name]: event.target.value })
              }
            />
          )}
          {name === "business_areas" && (
            <small id="business-areas-help">
              Beschreiben Sie, in welchen Branchen und Tätigkeitsbereichen Ihr
              Unternehmen arbeitet. Die öffentliche Zuordnung zu den
              Energieheld-Gewerken erfolgt anschließend bei der Prüfung.
            </small>
          )}
        </label>
      ))}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={styles.success} role="status">
          {state.success}
        </p>
      )}
      <div className={styles.links}>
        <button
          className="button button-primary"
          name="intent"
          value="save"
          type="submit"
          disabled={pending}
        >
          Änderungen speichern
        </button>
        <button
          className="button"
          name="intent"
          value="submit"
          type="submit"
          disabled={pending}
        >
          Zur Prüfung einreichen
        </button>
      </div>
      {pending && <p role="status">Ihr Profil wird gespeichert …</p>}
    </form>
  );
}
