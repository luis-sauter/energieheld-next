"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "@/app/(energieheld)/firma/profil/actions";
import type { ProfileFormState, ProfileValues } from "@/lib/company-profile";
import styles from "./auth.module.css";
import { OwnerTravelSelection, type OwnerTravelSelectionProps } from "./owner-travel-selection";

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
  { name: "contact_first_name", label: "Ansprechpartner: Vorname (optional)" },
  { name: "contact_last_name", label: "Ansprechpartner: Nachname (optional)" },
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
  { name: "country", label: "Land", autoComplete: "country-name" },
];

type SaveAction = (
  previous: ProfileFormState,
  form: FormData,
) => Promise<ProfileFormState>;

export function ProfileForm({
  initialValues,
  saveAction,
  submitLabel,
  businessAreasHelp,
  travelSelection,
}: {
  initialValues: ProfileValues;
  saveAction: SaveAction;
  submitLabel: string;
  businessAreasHelp: string;
  travelSelection?: OwnerTravelSelectionProps;
}) {
  const [values, setValues] = useState(initialValues);
  const [state, action, pending] = useActionState(saveAction, {});
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      {travelSelection && <OwnerTravelSelection {...travelSelection} pending={pending} />}
      {fields.map(({ name, label, type, multiline, autoComplete }) => (
        <label key={name} className={styles.field} htmlFor={name}>
          {name === "business_areas" && travelSelection ? "Weitere Informationen zu Ihrem Angebot" : label}
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
                  ? "Beschreiben Sie Ihr Angebot und Ihre Leistungen."
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
              maxLength={name.startsWith("contact_") ? 120 : undefined}
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
              {businessAreasHelp}
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
          {pending ? "Speichert …" : submitLabel}
        </button>
      </div>
      {pending && <p role="status">Das Profil wird gespeichert …</p>}
    </form>
  );
}

export function CompanyProfileForm({
  initialValues,
  travelSelection,
}: {
  initialValues: ProfileValues;
  travelSelection?: OwnerTravelSelectionProps;
}) {
  return (
    <ProfileForm
      initialValues={initialValues}
      travelSelection={travelSelection}
      saveAction={saveProfile}
      submitLabel="Speichern & Profil gestalten"
      businessAreasHelp="Optional: Ergänzen Sie hier Besonderheiten oder Leistungen, die sich nicht über die Auswahl oben abbilden lassen."
    />
  );
}
