import { siteSeo } from "@/lib/site-seo";
import { sitemapEntries } from "@/lib/seo";
import { loadReiseportalProfileIndex } from "@/lib/reiseportal-directory";

export const dynamic = "force-dynamic";
export default async function sitemap() {
  const config = siteSeo();
  if (!config.indexable) return [];
  return sitemapEntries(await loadReiseportalProfileIndex(), config);
}
