import type { BrandConfig } from "@/types/portal";

export const energieheld: BrandConfig = {
  id: "energieheld",
  name: "energieheld.bayern",
  tagline: "Sanieren mit Grips.",
  colors: { primary: "#19294b", accent: "#f29b19", surface: "#f8f6f2" },
  providerLabel: "Fachbetriebe",
  searchLabel: "Experten finden",
  cta: { label: "Als Experte eintragen", href: "/fuer-unternehmen" },
  navigation: [
    { label: "Experten finden", href: "/experten" },
    { label: "Gewerke", href: "/#gewerke" },
    { label: "So funktioniert’s", href: "/#so-funktionierts" },
  ],
  categories: [
    { id: "energieberatung", name: "Energieberatung", icon: "leaf" },
    { id: "solar", name: "Photovoltaik & Solar", icon: "sun" },
    { id: "heizung", name: "Heizung & Wärmepumpe", icon: "heat" },
    { id: "elektro", name: "Elektro & Smart Home", icon: "bolt" },
    { id: "dach", name: "Dach & Dämmung", icon: "home" },
    { id: "fenster", name: "Fenster & Türen", icon: "window" },
  ],
};
