import Image from 'next/image';
import Link from './navigation-link';
import type { DiscoveryEntry } from '@/data/reiseportal-discovery';
import type { Listing } from '@/types/portal';
import type { DiscoveryAdvertisingData } from '@/lib/discovery-advertising';
import { InlineBannerProvider } from '../advertising/inline-banner-editor';
import { ContextualCampaignSlot } from '../advertising/contextual-campaign-slot';
import { AdvertisingLayout } from './trades';
import { AccommodationCard } from './discovery-detail';
import { Breadcrumbs } from './breadcrumbs';
import { portalBreadcrumbs } from '@/lib/breadcrumbs';
import { JsonLd } from './json-ld';
import { breadcrumbSchema, collectionSchema, jsonLdGraph } from '@/lib/seo-schema';
import { destinationEditorial } from '@/data/destination-editorial';
import { mottoEditorial } from '@/data/motto-editorial';
import { mottoGroups, orderMottoItems, visibleMottoAds } from '@/lib/motto-rows';
import { MottoRow } from './motto-row';
import styles from './motto-detail.module.css';

export function MottoDetail({ entry, listings, advertising, seed, kind = 'theme' }: {
  entry: DiscoveryEntry; listings: Listing[]; advertising?: DiscoveryAdvertisingData; seed: string; kind?: 'theme' | 'destination';
}) {
  const destination = kind === 'destination';
  const rowDirection = 'right';
  const basePath = destination ? '/reiseziele' : '/mottoreisen';
  const sectionTitle = destination ? 'Reiseziele' : 'Mottoreisen';
  const editorial = destination ? { ...entry, ...destinationEditorial[entry.slug] } : mottoEditorial[entry.slug];
  const companies = orderMottoItems(listings, listing => listing.id, seed + ':companies');
  const banners = orderMottoItems(visibleMottoAds(advertising?.sliderAds ?? advertising?.ads ?? []).filter(ad => ad.placement !== 'top_banner'), ad => ad.id, seed + ':banners');
  const companyRows = mottoGroups(companies, 3), bannerRows = mottoGroups(banners, 2);
  const breadcrumbs = portalBreadcrumbs(entry.title, `${basePath}/${entry.slug}`, { name: sectionTitle, path: basePath });
  return <main id="hauptinhalt" className={styles.page} data-motto-detail={destination ? undefined : entry.slug} data-destination-detail={destination ? entry.slug : undefined}>
    <div className={styles.backdrop} aria-hidden="true"><Image src={editorial.image} alt="" fill sizes="100vw" preload /></div>
    <div className={`${styles.content} container`}>
      <JsonLd data={jsonLdGraph([breadcrumbSchema(breadcrumbs), collectionSchema({ name: entry.title,
        description: editorial.intro, path: `${basePath}/${entry.slug}`,
        about: destination ? { '@type': 'Place', name: entry.title } : { '@type': 'DefinedTerm', name: entry.title, termCode: `theme:${entry.slug}` },
        items: companies.map(listing => ({ name: listing.name, path: `/unterkuenfte/${listing.slug}` })) })])} />
      <Breadcrumbs items={breadcrumbs} />
      <header className={styles.hero}><p className="eyebrow">{sectionTitle}</p><h1>{destination && entry.title.includes('/') ? <><span className={styles.titlePart}>{entry.title.split('/')[0]}/</span><wbr /><span className={styles.titlePart}>{entry.title.split('/')[1]}</span></> : entry.title}</h1><p>{editorial.intro}</p></header>
      <section className={styles.stays} aria-labelledby="motto-stays">
        <p className="eyebrow">Aus dem Reiseportal</p><h2 id="motto-stays">Passende Unterkünfte</h2>
        <p className={styles.count}>{companies.length} passende {companies.length === 1 ? 'Unterkunft' : 'Unterkünfte'} · Entdecken Sie Ihre Gastgeber</p>
        <InlineBannerProvider options={advertising?.options}>
          {Array.from({ length: Math.max(companyRows.length, bannerRows.length) }, (_, i) => <div key={i} className={styles.pair}>
            {companyRows[i] && <MottoRow label={`Unterkünfte, Reihe ${i + 1}`} speed={[18, 20, 17][i]} direction={rowDirection}>
              {companyRows[i].map(listing => <AccommodationCard key={listing.id} listing={listing} motto
                cardEditing={Boolean(advertising?.options)} showImportMarker sizes="(max-width: 600px) 86vw, (max-width: 900px) 45vw, 360px" />)}
            </MottoRow>}
            {bannerRows[i] && <div className={`${styles.bannerRow}${destination || entry.slug === 'skifahren' ? ` ${styles.countryBannerRow}` : ''}`}><MottoRow label={`Banner, Reihe ${i + 1}`} speed={[22, 24][i]} direction={rowDirection}>
              {bannerRows[i].map(ad => <ContextualCampaignSlot editorOptions={advertising?.editorOptions} key={ad.id} placement={ad.placement} ad={ad}
                searchResult={!advertising?.ads.some(local => local.id === ad.id)} />)}
            </MottoRow></div>}
            {advertising?.premiumAds?.[i] && <div className={styles.premiumRow} data-static-premium={i + 1}>
              <ContextualCampaignSlot editorOptions={advertising.editorOptions} placement="top_banner" ad={advertising.premiumAds[i]} compactPremium searchResult={!advertising.ads.some(local => local.id === advertising.premiumAds[i].id)} />
            </div>}
          </div>)}
          {!companies.length && <p>Für diese Rubrik sind derzeit keine freigegebenen Unterkünfte verfügbar.</p>}
          {advertising?.options && <details className={styles.management}><summary>Bannerplätze verwalten</summary>
            <AdvertisingLayout ads={advertising.ads} sidebarOrder={advertising.sidebarOrder} collapseEmpty showEmptySlots>{null}</AdvertisingLayout>
          </details>}
        </InlineBannerProvider>
        {!!companies.length && <Link className="text-link" href={`/unterkuenfte-a-z?${destination ? 'ziel' : 'thema'}=${entry.slug}`}>Alle passenden Unterkünfte ansehen →</Link>}
      </section>
      <Link className="text-link" href={basePath}>{destination ? '← Weitere Reiseziele entdecken' : '← Alle Mottoreisen entdecken'}</Link>
    </div>
  </main>;
}
