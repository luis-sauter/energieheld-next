import { presentedBanners, type BannerPresentation } from './banner-presentation';
import { inlineAdContext } from './inline-ad-context';
import { portalAdSections } from './ad-target-areas';
import type { ActiveAd } from './ad-values';
import { matchSearchDocument, searchExcerpt, type SearchDocument, type SearchHit } from './portal-search-values';
import { legacyBannerPages } from '../data/legacy-banner-pages';
import { legacyBannerKey } from './banner-search-metadata';

export type SearchAdSource = ActiveAd & { path: string; rank: number; image_available?: boolean };
export type SearchPresentation = BannerPresentation & { path: string };
export type BannerSearchData = { banner_key: string; name: string; body: string; postal_code: string; city: string; categories: string; path: string; target_url: string; rank: number };
export function bannerSearchIdentity(ad: Pick<ActiveAd, 'source' | 'id' | 'target_url'>) {
  return ad.source === 'legacy' ? legacyBannerKey(ad.target_url) : `campaign:${ad.id}`;
}
export function legacySearchCatalog(): SearchDocument[] {
  return Object.entries(legacyBannerPages).flatMap(([path, banners]) => banners.map(banner => ({
    id: bannerSearchIdentity({ source: 'legacy', id: banner.id, target_url: banner.targetUrl }),
    type: 'ad', title: banner.alt, body: inlineAdContext(path)?.label ?? '', url: banner.targetUrl, context: path,
  })));
}
export function publicBannerSearch(ads: SearchAdSource[], presentations: SearchPresentation[], query: string, catalogHits?: SearchHit[], metadata?: BannerSearchData[]): SearchHit[] {
  const paths = [...new Set(['/', '/unterkuenfte-a-z', ...portalAdSections.flatMap(section => section.areas.map(area => `/${area.key}`)), ...ads.map(ad => ad.path), ...(metadata ?? []).map(row => row.path)])];
  const hits: SearchHit[] = [];
  for (const path of paths) {
    const context = inlineAdContext(path, true);
    if (!context) continue;
    // No images are rendered in search results: do not sign every creative.
    const sources = ads.filter(ad => ad.path === path).map(ad => ({ ...ad, imageUrl: ad.image_path && ad.image_available !== false ? 'public-creative' : undefined }));
    const resolved = presentedBanners(sources, presentations.filter(row => row.path === path), path);
    for (const ad of resolved) {
      if (ad.suppressed || !ad.headline.trim() || !/^https?:\/\//i.test(ad.target_url)) continue;
      const original = ad.source === 'legacy' ? legacyBannerPages[path]?.find(row => row.id === ad.id)?.targetUrl : undefined;
      const identity = bannerSearchIdentity({ ...ad, target_url: original ?? ad.target_url });
      const details = metadata?.find(row => row.banner_key === identity && row.path === path);
      // The DB projects only currently public creatives; do not search stale catalog
      // names after an admin rename, nor metadata of hidden/replaced sources.
      if (metadata && !details) continue;
      const body = details ? [details.body, details.postal_code, details.city, details.categories].filter(Boolean).join(' ') : `${ad.body_text ?? ''} ${context.label}`.trim();
      // Historical versions sometimes have different Joomla IDs, image files or
      // an "Empfehlung" suffix. One public advertiser/landing page is one result.
      const document = { id: identity, type: 'ad' as const, title: details?.name ?? ad.headline, body, url: ad.target_url };
      const source = sources.find(source => source.id === ad.id);
      const matched = metadata ? (details?.rank ? document : null) : catalogHits && ad.source === 'legacy'
        ? catalogHits.find(hit => hit.id === identity && hit.type === 'ad' && hit.context === path)
        : matchSearchDocument(document, query);
      if (metadata ? !details?.rank : !matched && !source?.rank) continue;
      hits.push({ ...document, excerpt: searchExcerpt(body, query), rank: Math.max(details?.rank ?? 0, ('rank' in (matched ?? {}) ? (matched as SearchHit).rank : 0), source?.rank ?? 0), external: true });
    }
  }
  return hits;
}
