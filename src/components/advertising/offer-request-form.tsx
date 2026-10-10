"use client";
import { useActionState } from "react";
import Image from "next/image";
import { updateOfferRequest } from "@/app/(energieheld)/angebot-anfragen/actions";
import { offerRequestStatuses } from "@/lib/offer-requests";
import { adPlacements, type AdCampaign, type AdFormState } from "@/lib/ad-values";
import { portalAdAreaLabel } from "@/lib/ad-target-areas";
import styles from "@/components/auth/auth.module.css";
export function OfferRequestDetail({campaign:c}:{campaign:AdCampaign}) {
 const [state,action,pending]=useActionState<AdFormState,FormData>(updateOfferRequest,{});
 return <section className={styles.card}><h2>{c.request_company_name || c.internal_name}</h2>
 <dl className={styles.details}><dt>Eingang</dt><dd>{new Date(c.created_at).toLocaleString("de-DE")}</dd>
 <dt>Ansprechpartner</dt><dd>{c.contact_name}</dd><dt>E-Mail</dt><dd>{c.contact_email}</dd>
 <dt>Telefon</dt><dd>{c.contact_phone||"Nicht angegeben"}</dd><dt>Website</dt><dd>{c.request_website||"Nicht angegeben"}</dd>
 <dt>Bezeichnung</dt><dd>{c.request_details?.internal_name ?? c.internal_name}</dd><dt>Ziel-URL</dt><dd>{c.request_details?.target_url ?? c.request_website ?? "Nicht angegeben"}</dd><dt>Gewünschter Zeitraum</dt><dd>{c.request_details?.requested_start_date || "Start offen"} – {c.request_details?.requested_end_date || "Ende offen"}</dd><dt>Werbeplatzwünsche</dt><dd>{c.request_details?.targets?.length ? c.request_details.targets.map((target) => (target.target_type === "homepage" ? "Startseite" : target.target_type === "experts_directory" ? "Unterkünfte A–Z" : portalAdAreaLabel(target.target_key ?? "")) + " · " + adPlacements[target.placement]).join(", ") : "Keine Platzierung gewählt"}</dd><dt>Anliegen</dt><dd style={{whiteSpace:"pre-wrap"}}>{c.request_message||"Keine Nachricht hinterlegt."}</dd></dl>
 {c.imageUrl && <Image src={c.imageUrl} alt={"Anfragebild: " + c.internal_name} width={640} height={360} style={{maxWidth:"100%",height:"auto",objectFit:"contain"}} />}
 {!c.image_path && c.request_details?.upload_path && <p>Bildupload noch nicht abgeschlossen.</p>}
 <form className={styles.form} action={action}><input name="id" type="hidden" value={c.id}/>
 <label className={styles.field}>Bearbeitungsstatus<select name="request_status" defaultValue={c.request_status??"new"}>{Object.entries(offerRequestStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <button className="button button-primary" disabled={pending}>Status speichern</button>
 {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form>
 <p>Diese unverbindliche Anfrage ist keine Buchung. Erledigte Anfragen bleiben im vollständigen Bestand erhalten.</p></section>;
}
