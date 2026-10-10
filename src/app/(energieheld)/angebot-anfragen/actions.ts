"use server";
import { createClient } from "@/lib/supabase/server";
import { submitOfferRequest, validateOfferRequest, offerRequestStatuses } from "@/lib/offer-requests";
import { checkAdmin, isProfileId } from "@/lib/admin-review";
import { validateMediaFile } from "@/lib/company-media";
import { revalidatePath } from "next/cache";
import type { AdFormState } from "@/lib/ad-values";
export async function sendOfferRequest(_state:AdFormState, form:FormData):Promise<AdFormState> {
 try {
 const client=await createClient(),uploaded=form.get("uploaded_path"),key=form.get("request_key");
 if(typeof uploaded==="string"){
  if(typeof key!=="string"||!uploaded.startsWith("campaigns/"+key+"/creative/")||uploaded.split("/").length!==4||!/^[0-9a-f-]{36}[.](jpg|png|webp)$/.test(uploaded.split("/")[3]))return {error:"Ungültiges Anfragebild."};
  const result=await client.storage.from("ad-media").download(uploaded);
  if(result.error||!result.data)return {error:"Das hochgeladene Bild konnte nicht geprüft werden."};
  const checked=await validateMediaFile(new File([result.data],"upload",{type:result.data.type}));
  if(!checked.file||!checked.extension||!uploaded.endsWith("."+checked.extension))return {error:checked.error||"Dateiformat und Bildpfad stimmen nicht überein."};
 }
 return await submitOfferRequest(client,form);
} catch {return {error:"Die Anfrage ist gerade nicht erreichbar. Bitte versuchen Sie es erneut."};}
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

export async function prepareOfferImage(form:FormData,type:string,size:number):Promise<AdFormState & {uploadPath?:string}>{
 const value=validateOfferRequest(form);if(!value.data)return {error:value.error};
 if(!["image/jpeg","image/png","image/webp"].includes(type)||!Number.isSafeInteger(size)||size<1||size>5242880)return {error:"Bitte wählen Sie JPEG, PNG oder WebP mit maximal 5 MB."};
 try{const {data,error}=await (await createClient()).rpc("prepare_portal_offer_image",{p_data:{...value.data,image_type:type,image_size:size},p_key:value.key});return error||typeof data!=="string"?{error:"Der Bildupload konnte nicht vorbereitet werden."}:{uploadPath:data};}catch{return {error:"Der Bildupload ist gerade nicht erreichbar."};}
}
