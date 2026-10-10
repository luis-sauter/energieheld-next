import type { SupabaseClient } from "@supabase/supabase-js";
import { adTargetUrl, type AdFormState } from "./ad-values";
export const offerRequestStatuses = { new: "Neu", in_progress: "In Bearbeitung", done: "Erledigt" } as const;
export const offerRequestSuccess = "Vielen Dank für Ihre Anfrage. Wir melden uns persönlich bei Ihnen.";
export function validateOfferRequest(form: FormData) {
 const get=(key:string)=> typeof form.get(key)==="string" ? String(form.get(key)).trim() : "";
 const data={company_name:get("company_name"),contact_name:get("contact_name"),contact_email:get("contact_email").toLowerCase(),contact_phone:get("contact_phone"),website:get("website"),message:get("message"),fax:get("fax"),consent:form.get("consent")==="on"};
 if (!data.company_name || data.company_name.length>120 || !data.contact_name || data.contact_name.length>120) return {error:"Bitte geben Sie Unternehmen und Ansprechpartner an (jeweils maximal 120 Zeichen)."};
 if (data.contact_email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) return {error:"Bitte geben Sie eine gültige E-Mail-Adresse an."};
 if (data.contact_phone.length>60 || data.message.length>5000 || (data.website && !adTargetUrl(data.website))) return {error:"Bitte prüfen Sie Telefon (maximal 60 Zeichen), Website (http/https) und Nachricht (maximal 5000 Zeichen)."};
 if (!data.consent) return {error:"Bitte stimmen Sie der Verarbeitung Ihrer Angaben zur Bearbeitung der Anfrage zu."};
 if (data.fax) return {error:"Die Anfrage konnte nicht gesendet werden."};
 const key=get("request_key");
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return {error:"Bitte laden Sie das Formular neu."};
 return {data,key};
}
export async function submitOfferRequest(client: SupabaseClient,form:FormData):Promise<AdFormState> {
 const value=validateOfferRequest(form);if(value.error || !value.data) return {error:value.error};
 const {error}=await client.rpc("submit_portal_offer_request",{p_data:value.data,p_key:value.key});
 if(error) return {error:error.message.includes("rate limit") ? "Bitte warten Sie etwas, bevor Sie erneut anfragen." : "Die Anfrage konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut."};
 // Future notification integration belongs AFTER this durable commit. Delivery must
 // never change the successful save into an error/retry or lose the stored request.
 return {success:offerRequestSuccess};
}
