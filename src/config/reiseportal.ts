import type { BrandConfig } from "@/types/portal";

export const reiseportal: BrandConfig = {
  id: "reiseportal",
  name: "DAS Reiseportal",
  tagline: "Neue Lieblingsorte entdecken.",
  colors: { primary: "#203f68", accent: "#ed9517", surface: "#f1f6f8" },
  providerLabel: "Unterkünfte",
  searchLabel: "Unterkunft entdecken",
  cta: { label: "Zur Energieheld-Vorschau", href: "/" },
  navigation: [
    { label: "Reiseziele", href: "#reiseziele" },
    { label: "Unterkünfte", href: "#unterkuenfte" },
  ],
  categories: [
    { id: "hotel", name: "Hotel", icon: "home" },
    { id: "ferienwohnung", name: "Ferienwohnung", icon: "window" },
    { id: "camping", name: "Camping", icon: "leaf" },
    { id: "pension", name: "Pension", icon: "home" },
  ],
};
