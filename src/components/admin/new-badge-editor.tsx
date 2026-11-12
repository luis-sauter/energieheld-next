'use client';
import {useActionState,useState} from 'react';
import type {BadgeKind,NewBadge} from '@/lib/new-badge';
import {newBadgeVisible} from '@/lib/new-badge';
import {saveNewBadge} from '@/app/(energieheld)/admin/new-badge-actions';
import styles from './new-badge-editor.module.css';
function localValue(value:string){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function NewBadgeEditor({kind,id,initial,now,error=false}:{kind:BadgeKind;id:string;initial:NewBadge|null;now:number;error?:boolean}) {
  const [enabled,setEnabled]=useState(initial?.enabled??newBadgeVisible(id,kind,[],now));
  const [expiry,setExpiry]=useState(initial?.expires_at?localValue(initial.expires_at):localValue(new Date(now+14*86400000).toISOString()));
  const [state,action,busy]=useActionState(async(previous:Parameters<typeof saveNewBadge>[0],form:FormData)=>{
    // Read the submitted native field, including edits that commit only on blur.
    // Conversion runs in the browser's timezone, not the web server's timezone.
    const local=String(form.get('expires_local')??'');
    if(local)setExpiry(local);
    const timestamp=Date.parse(local);
    form.set('expires_at',Number.isFinite(timestamp)?new Date(timestamp).toISOString():'');
    return saveNewBadge(previous,form);
  },{});
  const revision=state.row?.revision??initial?.revision??0;
  return <section className={styles.panel} aria-label="Neu-Badge verwalten"><h2>Neu-Badge</h2><p>Markieren Sie diesen Eintrag als neu. Das Badge verschwindet automatisch zum gewählten Zeitpunkt. Eine erneute Veröffentlichung setzt es nicht automatisch.</p>
    {error?<p role="alert">Badge-Einstellungen konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p>:<form action={action} className={styles.form} onReset={event=>event.preventDefault()}>
      <input type="hidden" name="kind" value={kind}/><input type="hidden" name="entity_id" value={id}/><input type="hidden" name="revision" value={revision}/>
      <label className={styles.toggle}><input type="checkbox" name="enabled" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={busy}/>Als „Neu“ kennzeichnen</label>
      <label>Badge anzeigen bis (Ihre Ortszeit)<input type="datetime-local" name="expires_local" value={expiry} onInput={e=>setExpiry(e.currentTarget.value)} onChange={e=>setExpiry(e.target.value)} disabled={!enabled||busy} required={enabled}/></label>
      <div className={styles.actions}><button type="button" className="button" disabled={busy} onClick={()=>{setEnabled(true);setExpiry(localValue(new Date(Date.now()+14*86400000).toISOString()));}}>14 Tage ab heute</button><button type="submit" className="button button-primary" disabled={busy}>{busy?'Wird gespeichert …':'Badge speichern'}</button></div>
      {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
    </form>}
  </section>;
}
