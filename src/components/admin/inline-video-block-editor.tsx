"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ProfileContentBlock} from '@/lib/profile-content';
import {useMediaLibrary} from './media-library-context';
import {removeLibraryVideo} from '@/app/(energieheld)/admin/mediathek/actions';
import {PortalVideo} from '@/components/portal/portal-video';
export function InlineVideoBlockEditor({block,save}:{block:ProfileContentBlock;save:(form:FormData)=>Promise<{error?:string;success?:string}>}) {
 const library=useMediaLibrary(),router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div>{block.video&&<PortalVideo {...block.video} name={block.content.title||'Unternehmensvideo'}/>}
 <button type="button" className="button" disabled={busy||!library} onClick={()=>library?.open({kind:'video_block',blockId:block.id})}>{block.video?'Video ersetzen':'Video aus Mediathek hinzufügen'}</button>
 {block.video&&<button type="button" className="button" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await removeLibraryVideo(block.profile_id,block.id);if(result.error)setError(result.error);else router.refresh();}catch{setError('Video konnte nicht entfernt werden.');}finally{setBusy(false);}}}>Video entfernen</button>}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const data=new FormData(e.currentTarget);data.set('intent','update');data.set('block_id',block.id);try{const result=await save(data);if(result.error)setError(result.error);else router.refresh();}catch{setError('Text konnte nicht gespeichert werden.');}finally{setBusy(false);}}}><label>Titel (optional)<input name="title" defaultValue={block.content.title??''} maxLength={200} disabled={busy}/></label><label>Beschreibung (optional)<textarea name="text" defaultValue={block.content.text} maxLength={10000} disabled={busy}/></label><button type="submit" className="button" disabled={busy}>Text speichern</button></form>
 {error&&<p role="alert">{error}</p>}</div>;
}
