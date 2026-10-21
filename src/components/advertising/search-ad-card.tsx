import type { TravelSearchBanner } from '@/lib/travel-search-banners';
import { adTargetHref } from '@/lib/ad-values';
import styles from './advertising.module.css';
import grid from './search-ad-card.module.css';
import { searchAdFormat, type CreativeGeometry } from '@/lib/search-ad-layout';

// Search geometry is independent of booking placement, size and presentation crop.
export function SearchAdCard({ banner, geometry, onGeometry, onEdit, loading = false, directory = false, onCreativeLoaded }: {
  banner: TravelSearchBanner; geometry?: CreativeGeometry; onGeometry?: (geometry: CreativeGeometry) => void;
  onEdit?: () => void; loading?: boolean;
  directory?: boolean; onCreativeLoaded?: (ad: TravelSearchBanner["ad"], image: HTMLImageElement) => void;
}) {
  const dimensions = geometry ?? { width: banner.ad.image_width ?? 0, height: banner.ad.image_height ?? 0 };
  const format = searchAdFormat(dimensions);
  const href = adTargetHref(banner.ad.target_url) ?? '#';
  return <article className={grid.card} data-search-banner={banner.banner_key} data-advertiser={banner.advertiser_key}
    data-placement={directory ? banner.ad.placement : undefined}
    data-format={directory ? 'directory' : format.wide ? 'wide' : 'other'} data-panoramic={!directory && format.panoramic || undefined}>
    {onEdit && <div className={grid.header}><button type="button" className={grid.edit} disabled={loading} aria-label={`Banner bearbeiten: ${banner.ad.headline}`} onClick={onEdit}>{loading ? 'Öffnet …' : 'Banner bearbeiten'}</button></div>}
    <a className={`${grid.creative} ${styles.interactiveCreative}`} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="sponsored noopener noreferrer" aria-label={banner.ad.headline}>
      {/* Original creative is contained, never stretched or cropped by slot geometry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={directory ? banner.ad.mobile_image?.imageUrl ?? banner.ad.imageUrl : banner.ad.imageUrl} alt={banner.ad.headline}
        width={(directory ? banner.ad.mobile_image?.width : undefined) ?? (dimensions.width || undefined)} height={(directory ? banner.ad.mobile_image?.height : undefined) ?? (dimensions.height || undefined)}
        crossOrigin={directory ? "anonymous" : undefined}
        loading={directory ? 'lazy' : dimensions.width && dimensions.height ? 'lazy' : 'eager'} decoding="async"
        onLoad={event => { onGeometry?.({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); onCreativeLoaded?.(banner.ad, event.currentTarget); }} />
    </a>
  </article>;
}
