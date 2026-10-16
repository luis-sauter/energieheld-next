'use server';
import {createClient} from '@/lib/supabase/server';
import {saveAdminBasicCategories} from '@/lib/admin-basic-accommodations';
import {basicIntegrationEnabled} from '@/lib/basic-public-search';
import {revalidatePath} from 'next/cache';
export async function saveBasicCategories(id:string,selected:string[],revision:number,reason:string){
  if(!basicIntegrationEnabled())return {error:'Die Basic-Bearbeitung ist noch nicht aktiviert.'};
  const result=await saveAdminBasicCategories(await createClient(),id,revision,selected,reason);
  if(result.success){revalidatePath('/admin/firmen');revalidatePath('/unterkuenfte-a-z');revalidatePath('/suche');}
  return result;
}
