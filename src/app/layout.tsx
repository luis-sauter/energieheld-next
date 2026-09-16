import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Energieheld Bayern – Fachbetriebe für Ihr Zuhause",
    template: "%s | Energieheld Bayern",
  },
  description:
    "Die Frontend-Vorschau für das neue Energieheld-Portal. Fachbetriebe für Energie, Bauen und Sanieren entdecken.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <a className="skip-link" href="#hauptinhalt">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
