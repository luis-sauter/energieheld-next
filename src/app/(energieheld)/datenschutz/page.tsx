import { LegalPage } from "@/components/portal/legal-page";
import sources from "@/data/weidner-legal-source.json";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Datenschutz", description: "Informationen zum Datenschutz und zum Umgang mit Ihren personenbezogenen Daten auf DAS-Reiseportal.com.", path: "/datenschutz", noindex: true });

export default function PrivacyPage() {
  const html = sources.datenschutz.html
    .replace(/<p>(?:\s|&nbsp;|<\/?span>|<br\s*\/?>)*<\/p>/gi, '')
    .replace('<div><p><span>Wenden Sie sich bei allgemeinen Fragen zur Webseite', '<div data-legal-compact><p><span>Wenden Sie sich bei allgemeinen Fragen zur Webseite');
  return <LegalPage title="Datenschutzerklärung">
    {/* Checked-in, allowlist-sanitized source text, never runtime third-party HTML. */}
    <div data-legal-source="datenschutz" dangerouslySetInnerHTML={{ __html: html }} />
  </LegalPage>;
}
