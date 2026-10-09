"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createLibraryCompany} from '@/app/(energieheld)/admin/mediathek/actions';
import styles from './media-library.module.css';
export function MediaCompanyCreate({onCreated,onOpen}:{onOpen?:()=>void;onCreated?:(company:{id:string;display_name:string})=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),formRef=useRef<HTMLFormElement>(null),router=useRouter();
 useEffect(()=>{const element=dialog.current;return ()=>{if(element?.open)element.close();};},[]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[matches,setMatches]=useState<{id:string;display_name:string}[]>([]);
 return <><button ref={trigger} type="button" className="button" onClick={()=>{setError('');setMatches([]);onOpen?.();if(!dialog.current?.open)dialog.current?.showModal();}}>+ Neues Unternehmen hinzufügen</button>
 <dialog ref={dialog} className="media-library-dialog" aria-label="Neues Unternehmen" onClose={()=>{formRef.current?.reset();setError('');setMatches([]);trigger.current?.focus({preventScroll:true});}} onCancel={e=>{if(busy)e.preventDefault();}}>
 <form ref={formRef} className={styles.details} onSubmit={async e=>{e.preventDefault();if(busy)return;const form=new FormData(e.currentTarget);setBusy(true);setError('');try{
 const result=await createLibraryCompany(form);if(result.error)setError(result.error);else if(result.matches)setMatches(result.matches);else if(result.id&&result.display_name){dialog.current?.close();onCreated?.({id:result.id,display_name:result.display_name});router.refresh();}
 }catch{setError('Unternehmen konnte nicht angelegt werden.');}finally{setBusy(false);}}}>
 <h2>Neues Unternehmen</h2><p>Wird als nicht veröffentlichter Entwurf ohne Benutzerkonto angelegt.</p>
 <label>Name der Unterkunft / des Unternehmens<input name="name" required maxLength={200} disabled={busy} autoFocus onChange={()=>setMatches([])}/></label>
 <label>Ort<input name="city" maxLength={200} disabled={busy}/></label><label>Land<input name="country" maxLength={120} disabled={busy}/></label><label>Website<input name="website" type="url" maxLength={1000} placeholder="https://" disabled={busy}/></label>
 {error&&<p role="alert">{error}</p>}{matches.length>0&&<div role="status"><p>Ähnliche Unternehmen vorhanden. Bestehendes auswählen oder bewusst neu anlegen.</p><ul>{matches.map(c=><li key={c.id}><button type="button" disabled={busy} onClick={()=>{dialog.current?.close();onCreated?.(c);}}>{c.display_name}</button></li>)}</ul><label><input name="override" type="checkbox" value="yes" required/> Trotzdem ein eigenständiges neues Unternehmen anlegen</label></div>}
 <div className={styles.options}><button className="button button-primary" disabled={busy} type="submit">{busy?'Wird angelegt …':'Unternehmen anlegen'}</button><button className="button" disabled={busy} type="button" onClick={()=>dialog.current?.close()}>Abbrechen</button></div>
 </form></dialog></>;
}
