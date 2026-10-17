'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {previewBasicWithdrawal,withdrawBasicSelection,type BasicWithdrawalFilter} from '@/lib/admin-basic-withdrawal';
export async function previewWithdrawal(filter:BasicWithdrawalFilter){return previewBasicWithdrawal(await createClient(),filter);}
export async function confirmWithdrawal(filter:BasicWithdrawalFilter,token:string,reason:string){
 const result=await withdrawBasicSelection(await createClient(),filter,token,reason);
 if(result.success)for(const path of ['/admin/firmen','/unterkuenfte-a-z','/suche'])revalidatePath(path);
 return result;
}
