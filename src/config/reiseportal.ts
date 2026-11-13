import type { BrandConfig } from "@/types/portal";
import { portalColors } from './portal-colors';

export const reiseportal: BrandConfig = {
  id: "reiseportal",
  name: "DAS-Reiseportal.com",
  tagline: "Neue Lieblingsorte entdecken.",
  colors: { primary: portalColors.blue, accent: portalColors.orange, surface: portalColors['light-gray'] },
  providerLabel: "Gastgeber",
  searchLabel: "Gastgeber entdecken",
  cta: { label: "Gastgeber A–Z", href: "/unterkuenfte-a-z" },
  navigation: [
    { label: "Reiseziele", href: "/reiseziele" },
    { label: "Mottoreisen", href: "/mottoreisen" },
    { label: "Gastgeber A–Z", href: "/unterkuenfte-a-z" },
  ],
  categories: [
    { id: "hotel", name: "Hotel", icon: "home" },
    { id: "ferienwohnung", name: "Ferienwohnung", icon: "window" },
    { id: "camping", name: "Camping", icon: "leaf" },
    { id: "pension", name: "Pension", icon: "home" },
  ],
};
