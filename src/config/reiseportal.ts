import type { BrandConfig } from "@/types/portal";

export const reiseportal: BrandConfig = {
  id: "reiseportal",
  name: "DAS Reiseportal",
  tagline: "Neue Lieblingsorte entdecken.",
  colors: { primary: "#13237F", accent: "#EF970C", surface: "#F8F9FA" },
  providerLabel: "Unterkünfte",
  searchLabel: "Unterkunft entdecken",
  cta: { label: "Unterkünfte A–Z", href: "/unterkuenfte-a-z" },
  navigation: [
    { label: "Reiseziele", href: "/reiseziele" },
    { label: "Mottoreisen", href: "/mottoreisen" },
    { label: "Unterkünfte A–Z", href: "/unterkuenfte-a-z" },
  ],
  categories: [
    { id: "hotel", name: "Hotel", icon: "home" },
    { id: "ferienwohnung", name: "Ferienwohnung", icon: "window" },
    { id: "camping", name: "Camping", icon: "leaf" },
    { id: "pension", name: "Pension", icon: "home" },
  ],
};
