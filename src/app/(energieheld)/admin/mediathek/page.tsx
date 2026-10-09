import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { checkAdmin } from '@/lib/admin-review';
import { requireAdminAccess } from '@/lib/admin';
import { MediaLibraryBrowser } from '@/components/admin/media-library-browser';
export const metadata = { title: 'Mediathek · Redaktion', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function MediaLibraryPage() { requireAdminAccess(await checkAdmin(await createClient())); return <main id="hauptinhalt" className="container"><p><Link href="/admin">← Zur Redaktion</Link></p><MediaLibraryBrowser /></main>; }
