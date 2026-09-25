import Image from "next/image";
import Link from "next/link";
import type { BrandConfig } from "@/types/portal";
import { MobileNavigation } from "./mobile-navigation";

export function PortalHeader({ brand }: { brand: BrandConfig }) {
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
