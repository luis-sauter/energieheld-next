import { presentedBanners, type BannerPresentation } from './banner-presentation';
import { inlineAdContext } from './inline-ad-context';
import { portalAdSections } from './ad-target-areas';
import type { ActiveAd } from './ad-values';
import { matchSearchDocument, searchExcerpt, type SearchDocument, type SearchHit } from './portal-search-values';
import { legacyBannerPages } from '../data/legacy-banner-pages';

export type SearchAdSource = ActiveAd & { path: string; rank: number; image_available?: boolean };
export type SearchPresentation = BannerPresentation & { path: string };
export function bannerSearchIdentity(ad: Pick<ActiveAd, 'source' | 'id' | 'target_url'>) {
  const target = new URL(ad.target_url);
  target.hostname = target.hostname.replace(/^www\./, '');
  target.pathname = target.pathname.replace(/\/index\.(php|html?)$/i, '/');
  return ad.source === 'legacy' ? `legacy:${target.href}` : `campaign:${ad.id}`;
}
export function legacySearchCatalog(): SearchDocument[] {
  return Object.entries(legacyBannerPages).flatMap(([path, banners]) => banners.map(banner => ({
    id: bannerSearchIdentity({ source: 'legacy', id: banner.id, target_url: banner.targetUrl }),
    type: 'ad', title: banner.alt, body: inlineAdContext(path)?.label ?? '', url: banner.targetUrl, context: path,
  })));
}
export function publicBannerSearch(ads: SearchAdSource[], presentations: SearchPresentation[], query: string, catalogHits?: SearchHit[]): SearchHit[] {
  const paths = ['/', '/unterkuenfte-a-z', ...portalAdSections.flatMap(section => section.areas.map(area => `/${area.key}`))];
  const hits: SearchHit[] = [];
  for (const path of paths) {
    const context = inlineAdContext(path)!;
    // No images are rendered in search results: do not sign every creative.
    const sources = ads.filter(ad => ad.path === path).map(ad => ({ ...ad, imageUrl: ad.image_path && ad.image_available !== false ? 'public-creative' : undefined }));
    const resolved = presentedBanners(sources, presentations.filter(row => row.path === path), path);
    for (const ad of resolved) {
      if (ad.suppressed || !ad.headline.trim() || !/^https?:\/\//i.test(ad.target_url)) continue;
      const body = `${ad.body_text ?? ''} ${context.label}`.trim();
      // Historical versions sometimes have different Joomla IDs, image files or
      // an "Empfehlung" suffix. One public advertiser/landing page is one result.
      const identity = bannerSearchIdentity(ad);
      const document = { id: identity, type: 'ad' as const, title: ad.headline, body, url: ad.target_url };
      const source = sources.find(source => source.id === ad.id);
      const matched = catalogHits && ad.source === 'legacy'
        ? catalogHits.find(hit => hit.id === identity && hit.type === 'ad' && hit.context === path)
        : matchSearchDocument(document, query);
      if (!matched && !source?.rank) continue;
      hits.push({ ...(matched ?? document), excerpt: searchExcerpt(body, query), rank: Math.max(matched?.rank ?? 0, source?.rank ?? 0), external: true });
    }
  }
  return hits;
}
