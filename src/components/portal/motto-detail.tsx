import Image from 'next/image';
import Link from './navigation-link';
import type { DiscoveryEntry } from '@/data/reiseportal-discovery';
import type { Listing } from '@/types/portal';
import type { DiscoveryAdvertisingData } from '@/lib/discovery-advertising';
import { InlineBannerProvider } from '../advertising/inline-banner-editor';
import { CampaignSlot } from '../advertising/campaign-view';
import { AdvertisingLayout } from './trades';
import { AccommodationCard } from './discovery-detail';
import { Breadcrumbs } from './breadcrumbs';
import { portalBreadcrumbs } from '@/lib/breadcrumbs';
import { JsonLd } from './json-ld';
import { breadcrumbSchema, collectionSchema, jsonLdGraph } from '@/lib/seo-schema';
import { mottoEditorial } from '@/data/motto-editorial';
import { mottoGroups, orderMottoItems, visibleMottoAds } from '@/lib/motto-rows';
import { MottoRow } from './motto-row';
import styles from './motto-detail.module.css';

export function MottoDetail({ entry, listings, advertising, seed }: {
  entry: DiscoveryEntry; listings: Listing[]; advertising?: DiscoveryAdvertisingData; seed: string;
}) {
  const editorial = mottoEditorial[entry.slug];
  const companies = orderMottoItems(listings, listing => listing.id, seed + ':companies');
  const banners = orderMottoItems(visibleMottoAds(advertising?.ads ?? []), ad => ad.id, seed + ':banners');
  const companyRows = mottoGroups(companies, 3), bannerRows = mottoGroups(banners, 2);
  const breadcrumbs = portalBreadcrumbs(entry.title, `/mottoreisen/${entry.slug}`, { name: 'Mottoreisen', path: '/mottoreisen' });
  return <main id="hauptinhalt" className={styles.page} data-motto-detail={entry.slug}>
    <div className={styles.backdrop} aria-hidden="true"><Image src={editorial.image} alt="" fill sizes="100vw" preload /></div>
    <div className={`${styles.content} container`}>
      <JsonLd data={jsonLdGraph([breadcrumbSchema(breadcrumbs), collectionSchema({ name: entry.title,
        description: editorial.intro, path: `/mottoreisen/${entry.slug}`,
        about: { '@type': 'DefinedTerm', name: entry.title, termCode: `theme:${entry.slug}` },
        items: companies.map(listing => ({ name: listing.name, path: `/unterkuenfte/${listing.slug}` })) })])} />
      <Breadcrumbs items={breadcrumbs} />
      <header className={styles.hero}><p className="eyebrow">Mottoreisen</p><h1>{entry.title}</h1><p>{editorial.intro}</p></header>
      <section className={styles.stays} aria-labelledby="motto-stays">
        <p className="eyebrow">Aus dem Reiseportal</p><h2 id="motto-stays">Passende Unterkünfte</h2>
        <p className={styles.count}>{companies.length} passende {companies.length === 1 ? 'Unterkunft' : 'Unterkünfte'} · Entdecken Sie Ihre Gastgeber</p>
        <InlineBannerProvider options={advertising?.options}>
          {Array.from({ length: Math.max(companyRows.length, bannerRows.length) }, (_, i) => <div key={i} className={styles.pair}>
            {companyRows[i] && <MottoRow label={`Unterkünfte, Reihe ${i + 1}`} speed={[18, 20, 17][i]}>
              {companyRows[i].map(listing => <AccommodationCard key={listing.id} listing={listing} motto
                cardEditing={Boolean(advertising?.options)} showImportMarker sizes="(max-width: 600px) 86vw, (max-width: 900px) 45vw, 360px" />)}
            </MottoRow>}
            {bannerRows[i] && <div className={styles.bannerRow}><MottoRow label={`Banner, Reihe ${i + 1}`} speed={[22, 24][i]}>
              {bannerRows[i].map(ad => <CampaignSlot key={ad.id} placement={ad.placement} ad={ad} />)}
            </MottoRow></div>}
          </div>)}
          {!companies.length && <p>Für diese Rubrik sind derzeit keine freigegebenen Unterkünfte verfügbar.</p>}
          {advertising?.options && <details className={styles.management}><summary>Bannerplätze verwalten</summary>
            <AdvertisingLayout ads={advertising.ads} sidebarOrder={advertising.sidebarOrder} collapseEmpty showEmptySlots>{null}</AdvertisingLayout>
          </details>}
        </InlineBannerProvider>
        {!!companies.length && <Link className="text-link" href={`/unterkuenfte-a-z?thema=${entry.slug}`}>Alle passenden Unterkünfte ansehen →</Link>}
      </section>
      <Link className="text-link" href="/mottoreisen">← Alle Mottoreisen entdecken</Link>
    </div>
  </main>;
}
