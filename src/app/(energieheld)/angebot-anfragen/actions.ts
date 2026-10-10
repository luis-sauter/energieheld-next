"use server";
import { createClient } from "@/lib/supabase/server";
import { submitOfferRequest, offerRequestStatuses } from "@/lib/offer-requests";
import { checkAdmin, isProfileId } from "@/lib/admin-review";
import { revalidatePath } from "next/cache";
import type { AdFormState } from "@/lib/ad-values";
export async function sendOfferRequest(_state:AdFormState, form:FormData):Promise<AdFormState> {
 try {return await submitOfferRequest(await createClient(),form);} catch {return {error:"Die Anfrage ist gerade nicht erreichbar. Bitte versuchen Sie es erneut."};}
}
export async function updateOfferRequest(_state:AdFormState,form:FormData):Promise<AdFormState> {
 const id=String(form.get("id")??""),status=String(form.get("request_status")??"");
 if(!isProfileId(id)||!Object.hasOwn(offerRequestStatuses,status)) return {error:"Bitte wählen Sie einen gültigen Status."};
 try {
 const client=await createClient();if(await checkAdmin(client)!=="admin") return {error:"Keine Berechtigung."};
 const {error}=await client.rpc("set_portal_offer_request_status",{p_id:id,p_status:status});
 if(error) return {error:"Der Status konnte nicht gespeichert werden."};
 revalidatePath("/admin");revalidatePath("/admin/werbung");revalidatePath("/admin/werbung/"+id);
 return {success:"Status gespeichert."};
 } catch {return {error:"Der Status konnte nicht gespeichert werden."};}
}
