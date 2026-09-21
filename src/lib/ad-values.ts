import { energieheld } from "../config/energieheld";
export const adPlacements = {
  top_banner: "Premium-Banner oben",
  sidebar_top: "Seitenanzeige oben",
  sidebar_middle: "Seitenanzeige Mitte",
  sidebar_bottom: "Seitenanzeige unten",
} as const;
export type AdPlacementId = keyof typeof adPlacements;
export type AdTarget = {
  target_type: "experts_directory" | "trade";
  category_id: string | null;
};
export type AdValues = {
  internal_name: string;
  placement: AdPlacementId;
  targets: AdTarget[];
  requested_start_date: string;
  requested_end_date: string;
  headline: string;
  body_text: string | null;
  target_url: string;
  image_path: string | null;
};
export type AdCampaign = AdValues & {
  id: string;
  profile_id: string;
  status: "draft" | "pending" | "approved" | "rejected" | "paused";
  approved_start_date: string | null;
  approved_end_date: string | null;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  imageUrl?: string;
  companyName?: string;
  unavailableTargets?: string[];
};
export type ActiveAd = Pick<
  AdCampaign,
  | "id"
  | "placement"
  | "headline"
  | "body_text"
  | "target_url"
  | "image_path"
  | "imageUrl"
>;
export type AdFormState = { error?: string; success?: string };
export function berlinToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function adStatus(
  c: Pick<AdCampaign, "status" | "approved_start_date" | "approved_end_date">,
  today = berlinToday(),
) {
  if (c.status === "approved")
    return c.approved_start_date && c.approved_start_date > today
      ? "Geplant"
      : c.approved_end_date && c.approved_end_date < today
        ? "Abgelaufen"
        : "Aktiv";
  return {
    draft: "Entwurf",
    pending: "Zur Prüfung eingereicht",
    rejected: "Abgelehnt",
    paused: "Pausiert",
  }[c.status];
}
export function adScopeLabel(c: Pick<AdValues, "targets">) {
  return c.targets
    .map((t) =>
      t.target_type === "experts_directory"
        ? "Experten A–Z"
        : (energieheld.categories.find((x) => x.id === t.category_id)?.name ??
          "Unbekanntes Gewerk"),
    )
    .join(" · ");
}
export function validAdDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function adTargetUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !/\s/.test(value) &&
      value.length <= 2048
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function validateAdValues(form: FormData): {
  data?: AdValues;
  error?: string;
} {
  const get = (key: string) =>
    typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const internal_name = get("internal_name"),
    headline = get("headline"),
    body_text = get("body_text"),
    placement = get("placement");
  if (
    !internal_name ||
    internal_name.length > 120 ||
    !headline ||
    headline.length > 100 ||
    body_text.length > 400
  )
    return {
      error:
        "Bitte geben Sie einen Kampagnennamen (max. 120 Zeichen), eine Überschrift (max. 100) und höchstens 400 Zeichen Beschreibung ein.",
    };
  if (!Object.hasOwn(adPlacements, placement))
    return { error: "Bitte wählen Sie einen gültigen Werbeplatz." };
  const selected = form.getAll("targets");
  if (
    !selected.length ||
    selected.length > 16 ||
    new Set(selected).size !== selected.length
  )
    return {
      error:
        "Bitte wählen Sie mindestens eine Zielseite ohne doppelte Auswahl.",
    };
  const targets: AdTarget[] = [];
  for (const value of selected) {
    if (value === "experts_directory")
      targets.push({ target_type: "experts_directory", category_id: null });
    else if (
      typeof value === "string" &&
      value.startsWith("trade:") &&
      energieheld.categories.some((c) => c.id === value.slice(6))
    )
      targets.push({ target_type: "trade", category_id: value.slice(6) });
    else return { error: "Bitte wählen Sie gültige Zielseiten." };
  }
  const requested_start_date = get("requested_start_date"),
    requested_end_date = get("requested_end_date");
  if (
    !validAdDate(requested_start_date) ||
    !validAdDate(requested_end_date) ||
    requested_end_date < requested_start_date
  )
    return {
      error:
        "Bitte wählen Sie einen gültigen Zeitraum. Das Ende darf nicht vor dem Start liegen.",
    };
  const target_url = adTargetUrl(get("target_url"));
  if (!target_url)
    return {
      error:
        "Bitte geben Sie eine gültige http://- oder https://-Zieladresse ohne Zugangsdaten ein.",
    };
  return {
    data: {
      internal_name,
      headline,
      body_text: body_text || null,
      placement: placement as AdPlacementId,
      targets,
      requested_start_date,
      requested_end_date,
      target_url,
      image_path: get("image_path") || null,
    },
  };
}
