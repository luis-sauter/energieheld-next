'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loadSearchBannerEditor } from '@/app/(energieheld)/inline-banner-actions';
import { groupSearchAdvertisements, searchCreativeKey, searchAdFormat, type CreativeGeometry } from '@/lib/search-ad-layout';
import type { TravelSearchBanner } from '@/lib/travel-search-banners';
import type { InlineBanner, InlineBannerOptions } from '@/lib/inline-ad-context';
import { InlineBannerDialog } from './inline-banner-editor';
import { SearchAdCard } from './search-ad-card';
import styles from './search-ad-results.module.css';

export function SearchAdResults({ banners, filtered, canEdit = false }: { banners: TravelSearchBanner[]; filtered: boolean; canEdit?: boolean }) {
  const router = useRouter();
  const [measured, setMeasured] = useState<Record<string, CreativeGeometry>>({});
  const [editor, setEditor] = useState<{ options: InlineBannerOptions; banner: InlineBanner } | null>(null);
  const [loadingKey, setLoadingKey] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const opening = useRef(false);
  const groups = groupSearchAdvertisements(banners, measured);
  function recordGeometry(banner: TravelSearchBanner, geometry: CreativeGeometry) {
    const key = searchCreativeKey(banner);
    const known = measured[key] ?? { width: banner.ad.image_width ?? 0, height: banner.ad.image_height ?? 0 };
    // Proven legacy geometry renders on the server; only unknown/different formats update.
    if (known.width > 0 && JSON.stringify(searchAdFormat(known)) === JSON.stringify(searchAdFormat(geometry))) return;
    setMeasured(current => ({ ...current, [key]: geometry }));
  }
  function open(banner: TravelSearchBanner) {
    if (opening.current) return;
    opening.current = true; setLoadingKey(banner.banner_key); setError(''); setMessage('');
    startTransition(async () => {
      try {
        const result = await loadSearchBannerEditor({ path: banner.source_path ?? '', id: banner.ad.id, placement: banner.ad.placement });
        if (result.options && result.banner) setEditor({ options: result.options, banner: result.banner });
        else setError(result.error ?? 'Dieses Banner konnte nicht geöffnet werden.');
      } catch { setError('Der Bannereditor konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.'); }
      finally { opening.current = false; setLoadingKey(''); }
    });
  }
  function saved(text: string) { setEditor(null); setMessage(text); router.refresh(); }
  if (!banners.length) return null;
  return <section className="travel-package-group" aria-labelledby="search-ads-title">
    <header className="travel-package-heading"><h2 id="search-ads-title">{filtered ? 'Passende Anzeigen' : 'Anzeigen'}</h2></header>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {pending && <p role="status">Bannereditor wird geladen …</p>}
    {(['wide', 'other'] as const).map(group => groups[group].length > 0 && <section key={group} className={styles.group} aria-labelledby={`search-ads-${group}`} data-ad-format-group={group}>
      <h3 id={`search-ads-${group}`} className={styles.heading}>{group === 'wide' ? 'Breite Banner' : 'Weitere Anzeigen'}</h3>
      <div className={styles.grid}>{groups[group].map(banner => <SearchAdCard key={banner.advertiser_key} banner={banner}
        geometry={measured[searchCreativeKey(banner)]} onGeometry={geometry => recordGeometry(banner, geometry)}
        onEdit={canEdit ? () => open(banner) : undefined} loading={pending && loadingKey === banner.banner_key} />)}</div>
    </section>)}
    {editor && <InlineBannerDialog key={`${editor.banner.id}:${editor.banner.placement}`} options={editor.options}
      selected={{ placement: editor.banner.placement, banner: editor.banner }} onClose={() => setEditor(null)}
      onSaved={() => saved('Das Banner wurde gespeichert.')} onMetadataSaved={() => saved('Die Suchdaten wurden gespeichert.')}
      onRemoved={warning => saved(warning || 'Das Banner wurde entfernt.')} onChanged={() => router.refresh()} />}
  </section>;
}
