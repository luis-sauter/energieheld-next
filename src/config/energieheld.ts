import type { BrandConfig } from "@/types/portal";
import { portalColors } from "./portal-colors";
import { trades } from "./trades";

export const energieheld: BrandConfig = {
  id: "energieheld",
  name: "energieheld.bayern",
  tagline: "Sanieren mit Grips.",
  colors: { primary: "#13237F", accent: portalColors.orange, surface: "#F8F9FA" },
  providerLabel: "Fachbetriebe",
  searchLabel: "Experten finden",
  cta: { label: "Als Experte eintragen", href: "/fuer-unternehmen" },
  navigation: [
    { label: "Experten A–Z", href: "/experten" },
    { label: "Gewerke", href: "/gewerke" },
    { label: "So funktioniert’s", href: "/#so-funktionierts" },
  ],
  categories: [
    { id: "energieberatung", name: "Energieberatung", icon: "leaf" },
    ...trades,
  ],
};
