"use client";
import {useRef,useState} from 'react';
import {uploadLibrary} from '@/app/(energieheld)/admin/mediathek/actions';
import {uploadPreparedAdminMedia} from '@/lib/admin-media-upload';
import {uploadProfileVideo} from '@/lib/profile-video-upload';
import {VIDEO_ACCEPT} from '@/lib/profile-video';
import {MediaLibraryCompanyPicker} from './media-library-company-picker';
import type {CompanySearchCache} from '@/lib/media-library-company-cache';
import styles from './media-library.module.css';
const kinds=[['gallery','Unternehmensbild'],['logo','Firmenlogo'],['contact','Ansprechpartnerbild'],['block','Bild für Präsentation'],['banner','Werbebanner'],['video','Unternehmensvideo']];
export function MediaLibraryUpload({profileId,profileName,initialKind,onDone,onClose,onBusy,searchCache}:{profileId:string;profileName:string;initialKind?:string;onDone:(company:{id:string;display_name:string},kind:string)=>void;onClose:()=>void;onBusy?:(busy:boolean)=>void;searchCache?:CompanySearchCache}) {
 const [company,setCompany]=useState({id:profileId,display_name:profileName}),[kind,setKind]=useState(kinds.some(k=>k[0]===initialKind)?initialKind!:'gallery');
 const [busy,setBusy]=useState(false),[results,setResults]=useState<{name:string;error?:string;success?:string}[]>([]),[progress,setProgress]=useState('');const lock=useRef(false);
 async function upload(files:FileList|null){if(!files?.length||!company.id||lock.current)return;lock.current=true;setBusy(true);onBusy?.(true);setResults([]);const queue=Array.from(files);let succeeded=false;
 try{for(let i=0;i<queue.length;i++) {const file=queue[i],video=file.type.startsWith('video/');const report=(label:string)=>setProgress(`${i+1}/${queue.length} · ${file.name} · ${label}`);
 const save=(form:FormData)=>{form.set('media_kind',video?'video':kind==='video'?'gallery':kind);return uploadLibrary(company.id,form);};
 let result;
 try {if(video)result=await uploadProfileVideo(save,file,report);else {const prepare=new FormData(),finish=new FormData();prepare.set('intent','prepare-library');finish.set('intent','library-upload');finish.set('file_name',file.name);result=await uploadPreparedAdminMedia(save,file,prepare,finish,report);}} catch{result={error:'Upload fehlgeschlagen. Bitte erneut versuchen.'};}
 setResults(current=>[...current,{name:file.name,...result}]);if(result.success)succeeded=true;
 }if(succeeded)onDone(company,kind);}finally{setBusy(false);lock.current=false;setProgress('');onBusy?.(false);}}
 return <div className={styles.details} role="region" aria-label="Medien hochladen" aria-busy={busy}>
 <h3>Medien hochladen</h3><label>Medienart<select disabled={busy} value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <MediaLibraryCompanyPicker searchCache={searchCache} value={company.id} name={company.display_name||'Unternehmen auswählen'} disabled={busy} allowAll={false} onChange={setCompany}/>
 {!company.id&&<p>Bitte ein Unternehmen auswählen oder neu anlegen.</p>}
 <label>Dateien auswählen<input type="file" multiple disabled={busy||!company.id} accept={kind==='video'?VIDEO_ACCEPT:'image/jpeg,image/png,image/webp,'+VIDEO_ACCEPT} onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label>
 <p>Bilder: JPG/PNG/WebP, maximal 5 MB nach Optimierung. Videos: MP4/WebM, maximal 50 MB. Gemischte Dateien werden einzeln geprüft.</p>
 {progress&&<div role="status"><progress aria-label="Upload läuft"/>{progress}</div>}
 <ul>{results.map((r,i)=><li key={i} role={r.error?'alert':'status'}>{r.name}: {r.error||r.success}</li>)}</ul>
 <button type="button" className="button" disabled={busy} onClick={onClose}>Upload schließen</button>
 </div>;
}
