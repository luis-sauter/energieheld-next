"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { offerWorkspaceFields, type OfferWorkspace } from '@/lib/offer-request-workspace';
import { updateOfferRequest } from "@/app/(energieheld)/angebot-anfragen/actions";
import { offerRequestStatuses } from "@/lib/offer-requests";
import { adPlacements, type AdCampaign, type AdFormState } from "@/lib/ad-values";
import { portalAdAreaLabel } from "@/lib/ad-target-areas";
import styles from "@/components/auth/auth.module.css";
export function OfferRequestDetail({campaign:c,workspace,workspaceError=false}:{campaign:AdCampaign;workspace?:OfferWorkspace|null;workspaceError?:boolean}) {
 const router=useRouter();
 const [note,setNote]=useState('');
 const [revision,setRevision]=useState(workspace?.revision??0);
 const [selected,setSelected]=useState(c.request_status??"new");
 const [state,action,pending]=useActionState<AdFormState,FormData>(async(previous,form)=>{
  const result=await updateOfferRequest(previous,form);
  if(result.success && result.requestStatus) setSelected(result.requestStatus);
  if(result.success) {if(result.revision!==undefined)setRevision(result.revision);setNote('');router.refresh();}
  return result;
 },{});
 const originals:Record<keyof typeof offerWorkspaceFields,string>={company_name:c.request_company_name??'',contact_name:c.contact_name??'',contact_email:c.contact_email??'',contact_phone:c.contact_phone??'',website:c.request_details?.target_url??c.request_website??'',internal_name:c.request_details?.internal_name??c.internal_name,requested_start_date:c.request_details?.requested_start_date??'',requested_end_date:c.request_details?.requested_end_date??'',placement_notes:''};
 return <section className={styles.card}><h2>{c.request_company_name || c.internal_name}</h2><h3>Ursprüngliche Anfrage</h3>
 <dl className={styles.details}><dt>Eingang</dt><dd>{new Date(c.created_at).toLocaleString("de-DE")}</dd>
 <dt>Ansprechpartner</dt><dd>{c.contact_name}</dd><dt>E-Mail</dt><dd>{c.contact_email}</dd>
 <dt>Telefon</dt><dd>{c.contact_phone||"Nicht angegeben"}</dd><dt>Website</dt><dd>{c.request_website||"Nicht angegeben"}</dd>
 <dt>Bezeichnung</dt><dd>{c.request_details?.internal_name ?? c.internal_name}</dd><dt>Ziel-URL</dt><dd>{c.request_details?.target_url ?? c.request_website ?? "Nicht angegeben"}</dd><dt>Gewünschter Zeitraum</dt><dd>{c.request_details?.requested_start_date || "Start offen"} – {c.request_details?.requested_end_date || "Ende offen"}</dd><dt>Werbeplatzwünsche</dt><dd>{c.request_details?.targets?.length ? c.request_details.targets.map((target) => (target.target_type === "homepage" ? "Startseite" : target.target_type === "experts_directory" ? "Unterkünfte A–Z" : portalAdAreaLabel(target.target_key ?? "")) + " · " + adPlacements[target.placement]).join(", ") : "Keine Platzierung gewählt"}</dd><dt>Anliegen</dt><dd style={{whiteSpace:"pre-wrap"}}>{c.request_message||"Keine Nachricht hinterlegt."}</dd></dl>
 {c.imageUrl && <Image src={c.imageUrl} alt={"Anfragebild: " + c.internal_name} unoptimized width={640} height={360} style={{maxWidth:"100%",height:"auto",objectFit:"contain"}} />}
 {c.image_path && <p><a className="button button-primary" href={`/api/offer-requests/${c.id}/image`} download>Originalbild herunterladen</a></p>}
 {!c.image_path && c.request_details?.upload_path && <p>Bildupload noch nicht abgeschlossen.</p>}
 <h3>Interne Bearbeitung</h3><p>Ergänzen oder korrigieren Sie Angaben für die Bearbeitung. Die ursprüngliche Anfrage oben bleibt erhalten.</p>
 {workspaceError&&<p role="alert">Die internen Ergänzungen konnten nicht geladen werden. Bitte laden Sie die Seite neu.</p>}
 <form className={styles.form} action={action} onReset={event=>event.preventDefault()}><input name="id" type="hidden" value={c.id}/><input name="revision" type="hidden" value={revision}/>
 <fieldset disabled={pending||workspaceError} style={{border:0,padding:0,margin:0,display:'grid',gap:16}}>
 {Object.entries(offerWorkspaceFields).map(([key,label])=><label key={key} className={styles.field}>{label}{key==='placement_notes'?<textarea name={key} maxLength={2000} rows={3} defaultValue={workspace?.details[key]??originals[key as keyof typeof originals]}/>:<input name={key} type={key.includes('date')?'date':key==='contact_email'?'email':key==='website'?'url':'text'} maxLength={2000} defaultValue={workspace?.details[key as keyof typeof originals]??originals[key as keyof typeof originals]}/>}</label>)}
 <label className={styles.field}>Bearbeitungsstatus<select name="request_status" value={selected} disabled={pending} onChange={event=>setSelected(event.target.value as keyof typeof offerRequestStatuses)}>{Object.entries(offerRequestStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <label className={styles.field}>Gesprächsnotiz hinzufügen<textarea name="note" maxLength={4000} rows={5} value={note} onChange={event=>setNote(event.target.value)} placeholder="Zum Beispiel Gesprächsergebnis oder vereinbarter Rückruf"/></label>
 <button className="button button-primary" disabled={pending}>Anfrage speichern</button></fieldset>
 {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form>
 {!!workspace?.notes.length&&<section aria-label="Bisherige Gesprächsnotizen"><h3>Gesprächsnotizen</h3>{[...workspace.notes].reverse().map((entry,index)=><article key={`${entry.at}-${index}`}><p><time dateTime={entry.at}>{new Date(entry.at).toLocaleString('de-DE')}</time></p><p style={{whiteSpace:'pre-wrap'}}>{entry.text}</p></article>)}</section>}
 <p>Diese unverbindliche Anfrage ist keine Buchung. Erledigte Anfragen bleiben im vollständigen Bestand erhalten.</p></section>;
}
