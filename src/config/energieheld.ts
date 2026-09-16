import type { BrandConfig } from "@/types/portal";
import { trades } from "./trades";

export const energieheld: BrandConfig = {
  id: "energieheld",
  name: "energieheld.bayern",
  tagline: "Sanieren mit Grips.",
  colors: { primary: "#13237f", accent: "#f39a08", surface: "#f7f9fc" },
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
