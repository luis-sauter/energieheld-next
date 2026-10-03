import { serializeJsonLd } from "@/lib/seo-schema";

export function JsonLd({ data }: { data: unknown }) {
  return data ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} /> : null;
}
