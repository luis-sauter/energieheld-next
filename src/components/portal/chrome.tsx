import Image from "next/image";
import Link from "next/link";
import type { BrandConfig } from "@/types/portal";
import { Icon } from "./icon";
import { MobileNavigation } from "./mobile-navigation";

export function PortalHeader({ brand }: { brand: BrandConfig }) {
  const navigation = (
    <>
      {brand.navigation.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
      <Link className="button button-outline header-cta" href={brand.cta.href}>
        {brand.cta.label}
        <Icon name="arrow" size={17} />
      </Link>
    </>
  );
  return (
    <>
      {brand.id === "reiseportal" && (
        <div className="preview-strip">
          Designvorschau{" "}
          <span>· Alle Anbieter und Angebote sind Beispieldaten</span>
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Link
            href={brand.id === "energieheld" ? "/" : "/portal-vorschau"}
            className="brand"
            aria-label={`${brand.name} – Startseite`}
          >
            {brand.id === "energieheld" ? (
              <Image
                src="/images/energieheld-logo.jpg"
                width={235}
                height={62}
                alt="energieheld.bayern – Sanieren mit Grips"
                priority
              />
            ) : (
              <span className="travel-wordmark">
                DAS<span>↗</span>Reiseportal
              </span>
            )}
          </Link>
          <nav className="desktop-nav" aria-label="Hauptnavigation">
            {navigation}
          </nav>
          <MobileNavigation>{navigation}</MobileNavigation>
        </div>
      </header>
    </>
  );
}

export function PortalFooter({ brand }: { brand: BrandConfig }) {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <Link
            className="footer-brand"
            href={brand.id === "energieheld" ? "/" : "/portal-vorschau"}
          >
            {brand.name}
          </Link>
          <p>
            {brand.tagline}
            <br />
            Menschen und Möglichkeiten zusammenbringen.
          </p>
        </div>
        <nav aria-label="Footernavigation">
          {brand.navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
        <span>
          {brand.id === "reiseportal"
            ? "Frontend-Vorschau · Fiktive Profile · Keine Kontaktvermittlung"
            : "Unternehmensverzeichnis · Beispielprofile sind gekennzeichnet"}
        </span>
      </div>
    </footer>
  );
}
