import type { TravelSearchBanner } from '@/lib/travel-search-banners';
import styles from './advertising.module.css';
import grid from './search-ad-card.module.css';

// Search geometry is independent of booking placement, size and presentation crop.
export function SearchAdCard({ banner }: { banner: TravelSearchBanner }) {
  return <article className={grid.card} data-search-banner={banner.banner_key} data-advertiser={banner.advertiser_key}>
    <span className={grid.label}>Anzeige</span>
    <a className={`${grid.creative} ${styles.interactiveCreative}`} href={banner.ad.target_url} target="_blank" rel="sponsored noopener noreferrer" aria-label={banner.ad.headline}>
      {/* Original creative is contained, never stretched or cropped by slot geometry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.ad.imageUrl} alt={banner.ad.headline} loading="lazy" decoding="async" />
    </a>
  </article>;
}
