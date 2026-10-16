import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireAdminAccess} from '@/lib/admin';
import {checkAdmin} from '@/lib/admin-review';
import {loadAdminBasicCategories} from '@/lib/admin-basic-accommodations';
import {BasicCategoryEditor} from '@/components/admin/basic-category-editor';
import {saveBasicCategories} from './actions';
import {basicIntegrationEnabled} from '@/lib/basic-public-search';
import styles from '@/components/admin/admin.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Basic-Unterkunft bearbeiten',robots:{index:false,follow:false}};
export default async function BasicEditorPage({params}:{params:Promise<{id:string}>}){
  const client=await createClient();requireAdminAccess(await checkAdmin(client));
  if(!basicIntegrationEnabled())notFound();
  const {id}=await params,entry=await loadAdminBasicCategories(client,id);
  if(!entry)return <main id="hauptinhalt" className="container"><Link href="/admin/firmen?ansicht=basic">Zur Unterkunftsverwaltung</Link><p role="alert">Die Basic-Unterkunft konnte nicht geladen werden. Bitte laden Sie die Seite erneut.</p></main>;
  return <main id="hauptinhalt" className={`container ${styles.page}`}><Link href="/admin/firmen?ansicht=basic">Zur Unterkunftsverwaltung</Link><p className="eyebrow">Basic-Unterkunft</p><h1>{entry.name}</h1><p>{[entry.city,entry.country].filter(Boolean).join(' · ')}</p><BasicCategoryEditor snapshot={entry.snapshot} saveAction={saveBasicCategories.bind(null,id)}/></main>;
}
