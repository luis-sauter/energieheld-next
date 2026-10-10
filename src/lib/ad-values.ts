import { energieheld } from "../config/energieheld";
import { portalAdAreaLabel, portalAdSection } from "./ad-target-areas";
export const adPlacements = {
  top_banner: "Premium-Banner oben",
  sidebar_top: "Banner A",
  sidebar_middle: "Banner B",
  sidebar_bottom: "Banner C",
  sidebar_04: "Banner D",
  sidebar_05: "Banner E",
  sidebar_06: "Banner F",
  sidebar_07: "Banner G",
  sidebar_08: "Banner H",
  sidebar_09: "Banner I",
  sidebar_10: "Banner J",
  sidebar_11: "Banner K",
  sidebar_12: "Banner L",
} as const;
export type AdPlacementId = keyof typeof adPlacements;
export type AdTarget = {
  target_type: "homepage" | "experts_directory" | "trade" | "portal_area";
  category_id: string | null;
  target_key?: string | null;
  placement: AdPlacementId;
};
export function adTargetAvailabilityKey(target: AdTarget) {
  const detail = target.target_type === "portal_area" ? `|${target.target_key}`
    : target.target_type === "trade" ? `|${target.category_id}` : "";
  return `${target.target_type}${detail}|${target.placement}`;
}
export function adTargetFormValue(target: AdTarget) {
  const scope = target.target_type === "portal_area" ? `portal_area:${target.target_key}`
    : target.target_type === "trade" ? `trade:${target.category_id}` : target.target_type;
  return `${scope}|${target.placement}`;
}
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
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};
export type AdCampaign = AdValues & {
  request_status?: "new" | "in_progress" | "done" | null;
  request_company_name?: string | null;
  request_message?: string | null;
  request_website?: string | null;
  id: string;
  profile_id: string | null;
  is_editorial?: boolean;
  lifecycle_group_id?: string | null;
  archived_at?: string | null;
  deletion_requested_at?: string | null;
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
  > & { status?: AdCampaign['status']; requested_start_date?: string; requested_end_date?: string; approved_start_date?: string | null; approved_end_date?: string | null; updated_at?: string; crop?: import("./image-crop").ImageCrop; banner_size?: import("./banner-presentation").BannerSize; source?: "legacy" | "campaign" | "hidden"; suppressed?: boolean;
    image_width?: number; image_height?: number; legacy_source?: AdPlacementId;
    mobile_image?: { imageUrl: string; width: number; height: number } };
export type AdFormState = { error?: string; success?: string };
const customerDraftContentFields = [
  "internal_name", "headline", "target_url", "body_text", "image_path",
  "contact_name", "contact_phone", "contact_email", "admin_note",
] as const;
export function isPristineCustomerAd(campaign: AdCampaign) {
  return campaign.status === "draft" && !campaign.is_editorial &&
    !campaign.archived_at && !campaign.submitted_at &&
    customerDraftContentFields.every((field) => !campaign[field]);
}
// Filter before count/range; generated from the same content fields as the form.
export const customerAdListFilter = [
  "status.neq.draft", "is_editorial.eq.true", "archived_at.not.is.null", "submitted_at.not.is.null",
  ...customerDraftContentFields.map((field) => `${field}.neq.""`),
].join(",");
export function berlinToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function adStatus(
  c: Pick<AdCampaign, "status" | "approved_start_date" | "approved_end_date" | "archived_at">,
  today = berlinToday(),
) {
  if (c.archived_at) return "Archiviert";
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
export function adScopeLabel(c: Pick<AdValues, "targets" | "placement">) {
  return c.targets
    .map((t) => `${
      t.target_type === "homepage"
        ? "Startseite"
        : t.target_type === "experts_directory"
          ? "Unterkünfte A–Z"
        : t.target_type === "portal_area"
          ? portalAdAreaLabel(t.target_key ?? "")
        : (energieheld.categories.find((x) => x.id === t.category_id)?.name ??
          "Unbekanntes Gewerk")
    } · ${adPlacements[t.placement ?? c.placement]}`,
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
        "Bitte geben Sie eine Bezeichnung (max. 120 Zeichen), eine Überschrift (max. 100) und höchstens 400 Zeichen Beschreibung ein.",
    };
  const selected = form.getAll("targets");
  if (
    !selected.length ||
    selected.length > 128 ||
    new Set(selected).size !== selected.length
  )
    return {
      error:
        "Bitte wählen Sie mindestens eine Zielseite ohne doppelte Auswahl.",
    };
  const targets: AdTarget[] = [];
  for (const value of selected) {
    if (typeof value !== "string") return { error: "Bitte wählen Sie gültige Werbeplätze." };
    const [scope, selectedSlot, extra] = value.split("|");
    const slot = selectedSlot ?? placement;
    if (extra || !Object.hasOwn(adPlacements, slot))
      return { error: "Bitte wählen Sie gültige Werbeplätze." };
    if (scope === "homepage" || scope === "experts_directory")
      targets.push({ target_type: scope, category_id: null, placement: slot as AdPlacementId });
    else if (scope.startsWith("portal_area:") && portalAdSection(scope.slice(12)))
      targets.push({ target_type: "portal_area", category_id: null, target_key: scope.slice(12), placement: slot as AdPlacementId });
    else if (scope.startsWith("trade:") && energieheld.categories.some((c) => c.id === scope.slice(6)))
      targets.push({ target_type: "trade", category_id: scope.slice(6), placement: slot as AdPlacementId });
    else return { error: "Bitte wählen Sie gültige Zielseiten." };
  }
  if (!targets.length) return { error: "Bitte wählen Sie mindestens einen Werbeplatz." };
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
  const contact_name = get("contact_name"), contact_phone = get("contact_phone"), contact_email = get("contact_email");
  if (contact_name.length > 120 || contact_phone.length > 60 || contact_email.length > 254 ||
      (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)))
    return { error: "Bitte prüfen Sie Name, Telefonnummer und E-Mail-Adresse." };
  return {
    data: {
      internal_name,
      headline,
      body_text: body_text || null,
      placement: (targets[0]?.placement ?? placement) as AdPlacementId,
      targets,
      contact_name: contact_name || null,
      contact_phone: contact_phone || null,
      contact_email: contact_email || null,
      requested_start_date,
      requested_end_date,
      target_url,
      image_path: get("image_path") || null,
    },
  };
}
