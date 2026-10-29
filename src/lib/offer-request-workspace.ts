import { validAdDate } from './ad-values';
export const offerWorkspaceFields = {
 company_name: 'Unternehmen', contact_name: 'Ansprechpartner', contact_email: 'E-Mail', contact_phone: 'Telefon',
 website: 'Website / Ziel-URL', internal_name: 'Bezeichnung', requested_start_date: 'Gewünschter Beginn',
 requested_end_date: 'Gewünschtes Ende', placement_notes: 'Ergänzungen zu den Werbeplatzwünschen',
} as const;
export type OfferWorkspace = { details: Partial<Record<keyof typeof offerWorkspaceFields,string>>; notes: {text:string;at:string;author:string}[]; revision:number };
export function validateOfferWorkspace(form: FormData) {
 const details: OfferWorkspace['details'] = {};
 for (const key of Object.keys(offerWorkspaceFields) as (keyof typeof offerWorkspaceFields)[]) {
  const value=form.get(key);
  if(typeof value!=='string'||value.length>2000) return {error:'Bitte begrenzen Sie jedes Ergänzungsfeld auf 2.000 Zeichen.'};
  details[key]=value.trim();
 }
 const note=form.get('note'), raw=form.get('revision');
 if(typeof note!=='string'||note.length>4000) return {error:'Eine Gesprächsnotiz darf maximal 4.000 Zeichen enthalten.'};
 if(typeof raw!=='string'||!/^\d{1,9}$/.test(raw)) return {error:'Bitte laden Sie die Anfrage neu.'};
 if(details.contact_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.contact_email)) return {error:'Bitte prüfen Sie die ergänzte E-Mail-Adresse.'};
 if(details.website) {try {const u=new URL(details.website);if(!['https:','http:'].includes(u.protocol)||u.username||u.password) throw Error();}catch{return {error:'Bitte geben Sie eine gültige http://- oder https://-Website an.'};}}
 if(details.requested_start_date&&details.requested_end_date&&details.requested_start_date>details.requested_end_date) return {error:'Das Ende darf nicht vor dem Beginn liegen.'};
 if([details.requested_start_date,details.requested_end_date].some(day=>day&&!validAdDate(day))) return {error:'Bitte geben Sie gültige Datumsangaben ein.'};
 return {details,note:note.trim(),revision:Number(raw)};
}
