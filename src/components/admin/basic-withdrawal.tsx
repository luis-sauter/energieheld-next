'use client';
import {useId,useState,useTransition} from 'react';
import type {BasicWithdrawalFilter,BasicWithdrawalPreview} from '@/lib/admin-basic-withdrawal';
import {previewWithdrawal,confirmWithdrawal} from '@/app/(energieheld)/admin/firmen/basic/withdrawal-actions';
import styles from './admin.module.css';
export function BasicWithdrawal({filter}:{filter:BasicWithdrawalFilter}){
 const [preview,setPreview]=useState<BasicWithdrawalPreview|null>(null),[reason,setReason]=useState(''),[message,setMessage]=useState(''),[pending,start]=useTransition(),field=useId();
 return <section className={styles.withdrawal} aria-label="Basic-Veröffentlichung zurücknehmen"><h2>Öffentliche Basics zurücknehmen</h2><p>Nur die öffentliche Anzeige wird deaktiviert. Private Daten, Kategorien und Belege bleiben erhalten.</p><button type="button" className="button" disabled={pending} onClick={()=>start(async()=>{setMessage('');setPreview(null);const r=await previewWithdrawal(filter);if(r.error)setMessage(r.error);else if(r.preview)setPreview(r.preview);})}>Betroffene Unterkünfte prüfen</button>
 {preview&&<><p>{preview.count} {preview.count===1?'öffentliche Basic-Unterkunft':'öffentliche Basic-Unterkünfte'} in dieser Auswahl.</p><ul>{preview.items.map(row=><li key={row.id}>{row.name}</li>)}</ul>{preview.count>0&&<><label htmlFor={field}>Begründung</label><textarea id={field} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/><button type="button" className="button" disabled={pending||!reason.trim()} onClick={()=>start(async()=>{const r=await confirmWithdrawal(filter,preview.token,reason);setMessage(r.error??r.success??'');setPreview(null);})}>Diese {preview.count} {preview.count===1?'Unterkunft':'Unterkünfte'} zurücknehmen</button></>}</>}{message&&<p role="status">{message}</p>}
 </section>;
}
