import { BannerCta } from "./banner-cta";
import type { TravelSearchBanner } from '@/lib/travel-search-banners';
import styles from './advertising.module.css';
import grid from './search-ad-card.module.css';
import { searchAdFormat, type CreativeGeometry } from '@/lib/search-ad-layout';

// Search geometry is independent of booking placement, size and presentation crop.
export function SearchAdCard({ banner, geometry, onGeometry, onEdit, loading = false }: {
  banner: TravelSearchBanner; geometry?: CreativeGeometry; onGeometry?: (geometry: CreativeGeometry) => void;
  onEdit?: () => void; loading?: boolean;
}) {
  const dimensions = geometry ?? { width: banner.ad.image_width ?? 0, height: banner.ad.image_height ?? 0 };
  const format = searchAdFormat(dimensions);
  return <article className={grid.card} data-search-banner={banner.banner_key} data-advertiser={banner.advertiser_key}
    data-format={format.wide ? 'wide' : 'other'} data-panoramic={format.panoramic || undefined}>
    {onEdit && <div className={grid.header}><button type="button" className={grid.edit} disabled={loading} aria-label={`Banner bearbeiten: ${banner.ad.headline}`} onClick={onEdit}>{loading ? 'Öffnet …' : 'Banner bearbeiten'}</button></div>}
    <a className={`${grid.creative} ${styles.interactiveCreative}`} href={banner.ad.target_url} target="_blank" rel="sponsored noopener noreferrer" aria-label={banner.ad.headline}>
      {/* Original creative is contained, never stretched or cropped by slot geometry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.ad.imageUrl} alt={banner.ad.headline} width={dimensions.width || undefined} height={dimensions.height || undefined}
        loading={dimensions.width && dimensions.height ? 'lazy' : 'eager'} decoding="async"
        onLoad={event => onGeometry?.({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
    </a>
    <div className={grid.footer}><span className={grid.label}>Gesponserter Treffer · Anzeige</span>
      {banner.ad.imageUrl && <BannerCta placement={banner.ad.placement} />}
    </div>
  </article>;
}
