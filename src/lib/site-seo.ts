import "server-only";
import { reiseportal } from "@/config/reiseportal";

type SeoEnvironment = Record<string, string | undefined>;

export function siteSeo(env: SeoEnvironment = process.env) {
  let canonicalOrigin: string | undefined;
  try {
    const url = new URL(env.SITE_URL ?? "");
    // Never derive identity from request hosts, deployment URLs or localhost.
    const previewHost = url.hostname.endsWith(".netlify.app") && url.hostname.includes("--");
    if (url.protocol === "https:" && !url.username && !url.password &&
        url.pathname === "/" && !url.search && !url.hash && !url.port &&
        !previewHost && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      canonicalOrigin = url.origin;
    }
  } catch {
    // Missing/invalid launch configuration fails closed, without guessed URLs.
  }
  const preview = env.SITE_ENVIRONMENT === "preview" ||
    (Boolean(env.CONTEXT) && env.CONTEXT !== "production") ||
    (Boolean(env.VERCEL_ENV) && env.VERCEL_ENV !== "production");
  return {
    siteName: reiseportal.name,
    organizationName: reiseportal.name,
    canonicalOrigin,
    indexable: Boolean(canonicalOrigin) && env.SITE_INDEXING === "enabled" &&
      env.NODE_ENV === "production" && !preview,
    titleTemplate: `%s | ${reiseportal.name}`,
    defaultTitle: "DAS Reiseportal – Reiseziele, Themen & Unterkünfte",
    defaultDescription: "Reiseinspiration, Reiseziele und Mottoreisen entdecken. Lernen Sie reale Unterkünfte und Reiseanbieter mit Standort und Kontakt im DAS Reiseportal kennen.",
    locale: "de_DE",
    language: "de",
    defaultImage: "/reiseportal/hero.jpg",
  };
}

export type SiteSeo = ReturnType<typeof siteSeo>;

export function siteUrl(path: string, config: SiteSeo = siteSeo()) {
  if (!config.canonicalOrigin || !path.startsWith("/") || path.startsWith("//")) return undefined;
  const url = new URL(path, config.canonicalOrigin);
  if (url.origin !== config.canonicalOrigin) return undefined;
  url.search = "";
  url.hash = "";
  return url.href;
}

export function privateSeoPath(path: string) {
  return /^\/(admin|firma|konto|login|registrieren|passwort-vergessen|passwort-zuruecksetzen|auth|api)(\/|$)/.test(path) ||
    /^\/unterkuenfte\/(demo-gmbh|energieheld-demo-gmbh-c3351d59)(\/|$)/.test(path);
}

export function robotsHeader(path: string, config: SiteSeo = siteSeo()) {
  if (privateSeoPath(path)) return "noindex, nofollow";
  return config.indexable ? undefined : "noindex, follow";
}
