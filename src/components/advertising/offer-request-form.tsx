"use client";
import Link from "next/link";
import { useActionState } from "react";
import { sendOfferRequest,updateOfferRequest } from "@/app/(energieheld)/angebot-anfragen/actions";
import { offerRequestStatuses } from "@/lib/offer-requests";
import type { AdCampaign,AdFormState } from "@/lib/ad-values";
import styles from "@/components/auth/auth.module.css";
export function OfferRequestForm({requestKey}:{requestKey:string}) {
 const [state,action,pending]=useActionState<AdFormState,FormData>(sendOfferRequest,{});
 if(state.success) return <div className={styles.success} role="status"><p>{state.success}</p><Link href="/">Zur Startseite</Link></div>;
 return <form action={action} className={styles.form} aria-busy={pending}>
 <p>Mit * gekennzeichnete Angaben sind erforderlich.</p>
 <input type="hidden" name="request_key" value={requestKey}/>
 <label className={styles.field}>Unternehmensname *<input name="company_name" autoComplete="organization" required maxLength={120}/></label>
 <label className={styles.field}>Name des Ansprechpartners *<input name="contact_name" autoComplete="name" required maxLength={120}/></label>
 <label className={styles.field}>E-Mail-Adresse *<input name="contact_email" type="email" autoComplete="email" required maxLength={254}/></label>
 <label className={styles.field}>Telefonnummer (optional)<input name="contact_phone" type="tel" autoComplete="tel" maxLength={60}/></label>
 <label className={styles.field}>Website (optional)<input name="website" type="url" autoComplete="url" placeholder="https://" maxLength={2048}/></label>
 <label className={styles.field}>Ihr Anliegen (optional)<textarea name="message" rows={5} maxLength={5000} placeholder="Was möchten Sie uns über Ihr Unternehmen erzählen?"/></label>
 <div hidden aria-hidden="true"><label>Fax<input name="fax" tabIndex={-1} autoComplete="off"/></label></div>
 <label><input name="consent" type="checkbox" required/> Ich stimme zu, dass meine Angaben zur persönlichen Bearbeitung meiner Anfrage verarbeitet werden. Mehr in der <Link href="https://das-reiseportal.com/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</Link>.</label>
 <p>Unverbindlich und ohne Konto. Mit dieser Anfrage entsteht keine Buchung oder Zahlung.</p>
 {state.error&&<p role="alert">{state.error}</p>}
 <button className="button button-primary" disabled={pending}>{pending?"Anfrage wird gesendet …":"Anfrage senden"}</button>
 </form>;
}
export function OfferRequestDetail({campaign:c}:{campaign:AdCampaign}) {
 const [state,action,pending]=useActionState<AdFormState,FormData>(updateOfferRequest,{});
 return <section className={styles.card}><h2>{c.request_company_name}</h2>
 <dl className={styles.details}><dt>Eingang</dt><dd>{new Date(c.created_at).toLocaleString("de-DE")}</dd>
 <dt>Ansprechpartner</dt><dd>{c.contact_name}</dd><dt>E-Mail</dt><dd>{c.contact_email}</dd>
 <dt>Telefon</dt><dd>{c.contact_phone||"Nicht angegeben"}</dd><dt>Website</dt><dd>{c.request_website||"Nicht angegeben"}</dd>
 <dt>Anliegen</dt><dd style={{whiteSpace:"pre-wrap"}}>{c.request_message||"Keine Nachricht hinterlegt."}</dd></dl>
 <form className={styles.form} action={action}><input name="id" type="hidden" value={c.id}/>
 <label className={styles.field}>Bearbeitungsstatus<select name="request_status" defaultValue={c.request_status??"new"}>{Object.entries(offerRequestStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <button className="button button-primary" disabled={pending}>Status speichern</button>
 {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form>
 <p>Diese unverbindliche Anfrage ist keine Buchung. Erledigte Anfragen bleiben im vollständigen Bestand erhalten.</p></section>;
}
