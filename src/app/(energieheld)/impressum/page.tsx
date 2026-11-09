import { LegalPage } from "@/components/portal/legal-page";
import sources from "@/data/weidner-legal-source.json";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Impressum", description: "Anbieterkennzeichnung und rechtliche Informationen zu DAS-Reiseportal.com.", path: "/impressum", noindex: true });

export default function ImprintPage() {
  // Remove empty legacy spacer paragraphs only; preserve every text/address line.
  let html = sources.impressum.html.replace(/<p>(?:\s|&nbsp;|<\/?span>|<br\s*\/?>)*<\/p>/gi, '');
  const start = html.indexOf('<p><span>Georg E. Weidner');
  const end = html.indexOf('<p><strong>Mitgliedschaften', start);
  if (start >= 0 && end > start) html = html.slice(0, start) + `<div data-legal-compact>
    <p>Georg E. Weidner, MA MSc</p>
    <p>Geschäftsführender Inhaber</p>
    <p>Leitender Berater</p>
    <p>Dipl.-Betriebswirt | Energietechniker</p>
    <p>Energie- &amp; Ressourceneffizienz-Experte für Wohn-/Nichtwohngebäude (dena | BAFA | KfW)</p>
    <p>ISO/IEC 42001 Lead Implementer: AI Management Systems (AIMS) | DEKRA</p>
    <p>ISO 9001 Lead Auditor | Deutsche Gesellschaft für Qualität e.V. (DGQ)</p>
    <p>Energieauditor nach DIN EN 16247-1, Anlagen &amp; Prozesse</p>
    <p>Fachbuchautor &quot;<a href="https://www.amazon.de/dp/3446462120" target="_blank" rel="noopener noreferrer">Qualitätsmanagement</a>&quot;</p>
  </div>` + html.slice(end);
  return <LegalPage title="Impressum">
    {/* Checked-in, allowlist-sanitized source text, never runtime third-party HTML. */}
    <div data-legal-source="impressum" dangerouslySetInnerHTML={{ __html: html }} />
  </LegalPage>;
}
