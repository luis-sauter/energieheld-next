import { accountCta } from "@/lib/portal-account";
import Image from "next/image";
import Link from "./navigation-link";
import type { EditorialCounts } from "@/lib/editorial-queue";
import type { BrandConfig } from "@/types/portal";
import type { AdminAccess } from "@/lib/admin-review";
import { MobileNavigation } from "./mobile-navigation";
import { DesktopNavigation } from "./desktop-navigation";
import { headerNavigation } from "./navigation-data";
import { AccountMenu, type AccountIdentity } from "./account-menu";
import { portalIdentity } from "@/config/portal-identity";
import styles from "./chrome.module.css";

export function PortalHeader({ brand, access = "unauthenticated", identity, hasCompany = false, taskCounts, taskError }: { brand: BrandConfig; access?: AdminAccess; identity?: AccountIdentity; hasCompany?: boolean; taskCounts?: EditorialCounts; taskError?: string }) {
  const cta = accountCta({ access, hasCompany });
  const navigation = headerNavigation(brand);
  return (
    <>
      <header className={`site-header ${brand.id === "reiseportal" ? styles.header : ""}`}>
        <div className={`container header-inner ${brand.id === "reiseportal" ? styles.headerRow : ""}`}>
          <Link
            href="/"
            className="brand"
            aria-label={`${brand.name} – Startseite`}
          >
            <Image
              src={portalIdentity.logo.src}
              width={portalIdentity.logo.width}
              height={portalIdentity.logo.height}
              alt={`${brand.name} – 15 Jahre`}
              className={styles.brandLogo}
              unoptimized
              priority
            />
          </Link>
          <DesktopNavigation items={navigation} />
          <Link className="button header-cta" href={cta.href}>{cta.label}</Link>
          {access === "admin" && <AccountMenu access={access} hasCompany={hasCompany} identity={identity} taskCounts={taskCounts} taskError={taskError} />}
          <MobileNavigation items={navigation} cta={cta} />
        </div>
      </header>
    </>
  );
}

export function PortalFooter({ brand }: { brand: BrandConfig }) {
  if (brand.id === "reiseportal") return <footer className={`site-footer ${styles.footer}`}>
    <div className={`container ${styles.main}`}>
      <div className={styles.brandBlock}>
        <Link href="/" prefetch={false} className={styles.logoSurface} aria-label={`${brand.name} – Startseite`}>
          <Image {...portalIdentity.logo} alt={`${brand.name} – 15 Jahre`} unoptimized loading="lazy" />
        </Link>
        <p className={styles.tagline}>{brand.tagline}</p>
      </div>
      <div className={styles.contactBlock}><h2 className={styles.heading}>Kontakt</h2><address className={styles.contact}>
        <strong>{portalIdentity.businessName}</strong>
        <a href={portalIdentity.phoneHref}>{portalIdentity.phone}</a>
        <a href={`mailto:${portalIdentity.email}`}>{portalIdentity.email}</a>
      </address></div>
    </div>
    <div className={`container ${styles.bottom}`}><span>© {new Date().getFullYear()} {brand.name}</span>
      <nav aria-label="Rechtliches und Redaktion" className={styles.legalLinks}>
        <Link href="/impressum" prefetch={false}>Impressum</Link><Link href="/datenschutz" prefetch={false}>Datenschutz</Link>
        <Link href="/login?next=/admin" prefetch={false}>Redaktion / Login</Link>
        <Link href="/designvorschau/unternehmensprofil" prefetch={false}>Profil-Designvorschau</Link>
      </nav>
    </div>
  </footer>;
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
        <Link href="/angebot-anfragen">Angebot anfragen</Link>
        <Link href="/login?next=/admin">Redaktion / Login</Link>
      </div>
    </footer>
  );
}
