import Image from "next/image";
import Link from "next/link";
import type { BrandConfig } from "@/types/portal";
import type { AdminAccess } from "@/lib/admin-review";
import { MobileNavigation } from "./mobile-navigation";

function AccountLinks({ access }: { access: AdminAccess }) {
  return access === "unauthenticated" ? <>
    <Link className="button header-cta" href="/registrieren">Firma eintragen</Link>
    <Link href="/login">Einloggen</Link>
  </> : <>
    <Link href="/firma">Firmenbereich</Link>
    {access === "admin" && <Link href="/admin">Admin</Link>}
  </>;
}

export function PortalHeader({ brand, access = "unauthenticated" }: { brand: BrandConfig; access?: AdminAccess }) {
  const navigation = (
    <>
      {brand.navigation.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </>
  );
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link
            href="/"
            className="brand"
            aria-label={`${brand.name} – Startseite`}
          >
            <Image
              src="/brand/das-reiseportal-logo.png"
              width={2048}
              height={333}
              alt="DAS Reiseportal"
              priority
            />
          </Link>
          <nav className="desktop-nav" aria-label="Hauptnavigation">
            {navigation}
          </nav>
          <nav className="header-account" aria-label="Unternehmen und Konto">
            <AccountLinks access={access} />
          </nav>
          <MobileNavigation>
            {navigation}
            <span className="mobile-account-label">Unternehmen und Konto</span>
            <AccountLinks access={access} />
          </MobileNavigation>
        </div>
      </header>
    </>
  );
}

export function PortalFooter({ brand, access = "unauthenticated" }: { brand: BrandConfig; access?: AdminAccess }) {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <Link
            className="footer-brand"
            href="/"
          >
            {brand.name}
          </Link>
          <p>
            {brand.tagline}
            <br />
            Reiseziele, Mottoreisen und Unterkünfte entdecken.
          </p>
        </div>
        <nav aria-label="Footernavigation">
          {brand.navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <span className="footer-account-links">
            <Link href="/registrieren">Firma eintragen</Link>
            <Link href={access === "unauthenticated" ? "/login" : "/firma"}>
              {access === "unauthenticated" ? "Einloggen" : "Firmenbereich"}
            </Link>
            <Link href="/fuer-unternehmen">Für Unternehmen</Link>
          </span>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
        <span>
          Unterkünfte und Anbieter im deutschsprachigen Raum
        </span>
      </div>
    </footer>
  );
}
