import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DAS Reiseportal",
    template: "%s | DAS Reiseportal",
  },
  description:
    "Reiseziele, Mottoreisen und Unterkünfte im deutschsprachigen Raum entdecken.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#hauptinhalt">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
