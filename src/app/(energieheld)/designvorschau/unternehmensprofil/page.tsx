import { notFound } from 'next/navigation';
import { loadAccommodationPage } from '@/lib/accommodation-page';
import { loadPublicProfileContent } from '@/lib/profile-content';
import { createPublicClient } from '@/lib/supabase/public';
import { pageMetadata } from '@/lib/seo';
import { ProfileDesignPreview } from '@/components/portal/profile-design-preview';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({ title: 'Profil-Designvorschau – Hofgut Hafnerleiten', description: 'Isolierte Musterseite zur Designabnahme.', path: '/designvorschau/unternehmensprofil', noindex: true });

export default async function CompanyDesignPreview() {
  const result = await loadAccommodationPage('unternehmen-6cd02ae2-75ab-4273-8cd8-fc62da38b2db');
  if (result.error) return <main id="hauptinhalt" className="container section"><h1>Designvorschau derzeit nicht verfügbar</h1><p role="alert">{result.error}</p></main>;
  if (!result.data || result.data.isDemo || result.data.isPreview) notFound();
  const content = await loadPublicProfileContent(createPublicClient(), result.data.id);
  return <ProfileDesignPreview listing={result.data} blocks={content.blocks} />;
}
