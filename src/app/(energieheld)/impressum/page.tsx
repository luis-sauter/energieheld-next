import { LegalPage } from "@/components/portal/legal-page";
import sources from "@/data/weidner-legal-source.json";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Impressum", description: "Impressum: unverändert übernommener Originaltext von WEIDNER EBM.", path: "/impressum", noindex: true });

export default function ImprintPage() {
  return <LegalPage title="Impressum" sourceUrl={sources.impressum.sourceUrl}>
    {/* Checked-in, allowlist-sanitized source text, never runtime third-party HTML. */}
    <div data-legal-source="impressum" dangerouslySetInnerHTML={{ __html: sources.impressum.html }} />
  </LegalPage>;
}
