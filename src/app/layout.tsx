import { rootMetadata } from "@/lib/seo";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = rootMetadata();

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
