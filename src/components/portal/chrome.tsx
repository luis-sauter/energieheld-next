import Image from "next/image";
import Link from "next/link";
import type { BrandConfig } from "@/types/portal";
import type { AdminAccess } from "@/lib/admin-review";
import { MobileNavigation } from "./mobile-navigation";
import { AccountMenu, type AccountIdentity } from "./account-menu";

export function PortalHeader({ brand, access = "unauthenticated", identity }: { brand: BrandConfig; access?: AdminAccess; identity?: AccountIdentity }) {
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
          <Link className="button header-cta" href="/registrieren">Unterkunft eintragen</Link>
          <AccountMenu access={access} identity={identity} />
          <MobileNavigation>
            {navigation}
            <Link className="button header-cta" href="/registrieren">Unterkunft eintragen</Link>
          </MobileNavigation>
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
          <span className="footer-brand">{brand.name}</span>
          <p>{brand.tagline}</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
      </div>
    </footer>
  );
}
