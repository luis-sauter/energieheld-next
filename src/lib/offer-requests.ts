import type { SupabaseClient } from "@supabase/supabase-js";
import { adTargetUrl, adPlacements, validAdDate, type AdCampaign, type AdTarget, type AdFormState } from "./ad-values";
import { portalAdSection } from "./ad-target-areas";
export const offerRequestStatuses = { new: "Neu", in_progress: "In Bearbeitung", done: "Erledigt" } as const;
export const offerRequestSuccess = "Vielen Dank für Ihre Anfrage. Wir melden uns persönlich bei Ihnen.";
export function emptyOfferCampaign(id: string): AdCampaign {
 return { id,profile_id:null,status:"draft",internal_name:"",headline:"",body_text:null,target_url:"",image_path:null,placement:"sidebar_top",targets:[],contact_name:null,contact_email:null,contact_phone:null,requested_start_date:"",requested_end_date:"",approved_start_date:null,approved_end_date:null,admin_note:null,submitted_at:null,reviewed_at:null,created_at:"",updated_at:"" };
}
export function validateOfferRequest(form: FormData) {
 const get=(key:string)=>typeof form.get(key)==="string"?String(form.get(key)).trim():"";
 const company_name=get("company_name"),contact_name=get("contact_name"),contact_email=get("contact_email").toLowerCase(),contact_phone=get("contact_phone"),internal_name=get("internal_name"),target_url=adTargetUrl(get("target_url")),message=get("body_text"),fax=get("fax"),consent=form.get("consent")==="on";
 if(company_name.length>120||!contact_name||contact_name.length>120||!contact_phone||contact_phone.length>60||!internal_name||internal_name.length>120) return {error:"Bitte geben Sie Ansprechpartner, Telefonnummer und Bezeichnung an (Name/Bezeichnung maximal 120, Telefon maximal 60 Zeichen)."};
 if(contact_email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) return {error:"Bitte geben Sie eine gültige E-Mail-Adresse an."};
 if(!target_url) return {error:"Bitte geben Sie eine gültige http://- oder https://-Zieladresse ohne Zugangsdaten ein."};
 if(message.length>400) return {error:"Bitte geben Sie höchstens 400 Zeichen Hinweise ein."};
 const start=get("requested_start_date"),end=get("requested_end_date");
 if((start&&!validAdDate(start))||(end&&!validAdDate(end))||(start&&end&&end<start)) return {error:"Bitte wählen Sie einen gültigen Zeitraum. Das Ende darf nicht vor dem Start liegen."};
 const selected=form.getAll("targets");if(selected.length>128||new Set(selected).size!==selected.length) return {error:"Bitte wählen Sie Werbeplätze ohne doppelte Auswahl."};
 const targets:AdTarget[]=[];
 for(const value of selected){if(typeof value!=="string")return {error:"Ungültiger Werbeplatz."};const [scope,slot,extra]=value.split("|");if(extra||!Object.hasOwn(adPlacements,slot))return {error:"Ungültiger Werbeplatz."};if(scope==="homepage"||scope==="experts_directory")targets.push({target_type:scope,category_id:null,placement:slot as keyof typeof adPlacements});else if(scope.startsWith("portal_area:")&&portalAdSection(scope.slice(12)))targets.push({target_type:"portal_area",target_key:scope.slice(12),category_id:null,placement:slot as keyof typeof adPlacements});else return {error:"Ungültiger Werbebereich."};}
 if(!consent)return {error:"Bitte stimmen Sie der Verarbeitung Ihrer Angaben zur Bearbeitung der Anfrage zu."};if(fax)return {error:"Die Anfrage konnte nicht gesendet werden."};
 const key=get("request_key");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))return {error:"Bitte laden Sie das Formular neu."};
 return {data:{company_name,contact_name,contact_email,contact_phone,website:target_url,message,fax,consent,details:{internal_name,target_url,requested_start_date:start,requested_end_date:end,targets}},key};
}
export async function submitOfferRequest(client:SupabaseClient,form:FormData):Promise<AdFormState>{const value=validateOfferRequest(form);if(value.error||!value.data)return {error:value.error};const {error}=await client.rpc("submit_portal_offer_request",{p_data:{...value.data,...(typeof form.get("uploaded_path")==="string"?{uploaded_path:form.get("uploaded_path")}:{})},p_key:value.key});if(error)return {error:error.message.includes("rate limit")?"Bitte warten Sie etwas, bevor Sie erneut anfragen.":"Die Anfrage konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut."};
 // Notifications belong after successful durable storage; currently no mail is sent.
 return {success:offerRequestSuccess};}
