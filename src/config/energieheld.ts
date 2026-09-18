import type { BrandConfig } from "@/types/portal";
import { trades } from "./trades";

export const energieheld: BrandConfig = {
  id: "energieheld",
  name: "energieheld.bayern",
  tagline: "Sanieren mit Grips.",
  colors: { primary: "#29332f", accent: "#efaa4b", surface: "#f6f5f1" },
  providerLabel: "Fachbetriebe",
  searchLabel: "Experten finden",
  cta: { label: "Unternehmen eintragen", href: "/fuer-unternehmen" },
  navigation: [
    { label: "Themen", href: "/#gewerke" },
    { label: "Empfehlungen", href: "/experten" },
    { label: "Aktuelles", href: "/#aktuelles" },
    { label: "Für Unternehmen", href: "/fuer-unternehmen" },
  ],
  categories: [
    { id: "energieberatung", name: "Energieberatung", icon: "leaf" },
    ...trades,
  ],
};
