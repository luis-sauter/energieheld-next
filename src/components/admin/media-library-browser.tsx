"use client";
import { startTransition, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { searchLibraryProfiles, applyLibraryAsset, archiveLibraryAsset, deleteLibraryAsset, libraryProfiles, loadLibrary, updateLibraryAsset, uploadLibrary } from '@/app/(energieheld)/admin/mediathek/actions';
import { uploadPreparedAdminMedia } from '@/lib/admin-media-upload';
import { readMediaRights, mediaSelectionLimit, MEDIA_LIBRARY_PAGE_SIZE, type MediaAsset, type MediaLibraryPage, type MediaLibraryTarget } from '@/lib/media-library';
import styles from './media-library.module.css';
import { MediaLibraryCompanyPicker } from './media-library-company-picker';
import {companySearchCache} from '@/lib/media-library-company-cache';
import { MediaLibraryUpload } from './media-library-upload';
import { PortalVideo } from '@/components/portal/portal-video';
import { revealMediaDetails, restoreMediaGrid } from '@/lib/media-library-navigation';
const kinds = [['', 'Alle Medien'], ['images', 'Bilder'], ['video', 'Videos'], ['gallery', 'Unternehmensbilder'], ['logo', 'Logos'], ['contact', 'Ansprechpartnerbilder'], ['block', 'Inhaltsblöcke'], ['banner', 'Werbebanner'], ['unused', 'Nicht verwendete Medien']];
export function MediaLibraryBrowser({ initialProfileId, initialProfileName, initialKind, target, onClose, onApplied, onBusy, onSelected, onUpload }: {
    initialProfileId?: string;
    initialProfileName?: string;
    initialKind?: string;
    onSelected?: (asset: MediaAsset) => void | Promise<void>;
    onUpload?: (file: File) => void | Promise<void>;
    target?: MediaLibraryTarget;
    onClose?: () => void;
    onApplied?: () => void | Promise<void>;
    onBusy?: (busy: boolean) => void;
}) {
    const [profile, setProfile] = useState(initialProfileId ?? ''), [profiles, setProfiles] = useState<{
        id: string;
        display_name: string;
    }[]>(initialProfileId && initialProfileName ? [{id:initialProfileId,display_name:initialProfileName}] : []);
    const [query, setQuery] = useState(''), [kind, setKind] = useState(initialKind ?? ''), [page, setPage] = useState(1), [archived, setArchived] = useState(false), [revision, setRevision] = useState(0);
    const [result, setResult] = useState<MediaLibraryPage>({ items: [], count: 0 }), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
    const [companyCache] = useState(()=>companySearchCache(searchLibraryProfiles));
    const [uploadOpen, setUploadOpen] = useState(false);
    const [selected, setSelected] = useState<MediaAsset[]>([]), [details, setDetails] = useState<MediaAsset | null>(null), [dimensions, setDimensions] = useState('');
    const lock = useRef(false), upload = useRef<HTMLInputElement>(null), container = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null), returnDetails = useRef<HTMLElement | null>(null), gridScroll = useRef(0);
    useEffect(() => {
        if (details && container.current && heading.current) revealMediaDetails(container.current, heading.current, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }, [details]);
    function closeDetails() {
        setDetails(null);
        if (container.current) restoreMediaGrid(container.current, returnDetails.current, gridScroll.current);
    }
    const limit = onSelected ? 1 : mediaSelectionLimit(target);
    useEffect(() => { if (initialProfileName) return; let alive = true; startTransition(() => { void libraryProfiles(initialProfileName ? undefined : initialProfileId).then(r => { if (alive) {
        setProfiles(current => [...current, ...r.items.filter(p => !current.some(v => v.id === p.id))]);
        if (r.error)
            setError(r.error);
    } }).catch(() => { if (alive)
        setError('Unternehmen konnten nicht geladen werden.'); }); }); return () => { alive = false; }; }, [initialProfileId, initialProfileName]);
    useEffect(() => {
        let alive = true;
        const timer = setTimeout(() => { startTransition(() => { void loadLibrary(profile || null, kind, query, page, archived).then(r => { if (alive) {
            setResult(r);
            setLoading(false);
            if (r.error)
                setError(r.error);
        } }).catch(() => { if (alive) {
            setError('Bilder konnten nicht geladen werden.');
            setLoading(false);
        } }); }); }, query ? 250 : 0);
        return () => { alive = false; clearTimeout(timer); };
    }, [profile, kind, query, page, archived, revision]);
    function reset() { setLoading(true); setPage(1); setSelected([]); setDetails(null); setError(''); }
    function reload() { setLoading(true); setRevision(r => r + 1); }
    async function task(work: () => Promise<void>) { if (lock.current)
        return; lock.current = true; setBusy(true); onBusy?.(true); setError(''); setStatus(''); try {
        await work();
    }
    catch {
        setError('Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    }
    finally {
        lock.current = false;
        setBusy(false);
        onBusy?.(false);
    } }
    function toggle(a: MediaAsset) { if (a.kind === 'video' && (onSelected || target && target.kind !== 'video' && target.kind !== 'video_block') || a.kind !== 'video' && (target?.kind === 'video' || target?.kind === 'video_block')) return; setSelected(current => current.some(v => v.id === a.id) ? current.filter(v => v.id !== a.id) : limit === 1 ? [a] : current.length < limit ? [...current, a] : current); }
    function useSelected() { void task(async () => { if (onSelected && selected[0]) { await onSelected(selected[0]); return; } if (!target || !selected.length || selected.length > limit)
        return; let applied = 0; for (const asset of selected) {
        const result = await applyLibraryAsset(asset.id, target);
        if (result.error) {
            setError(result.error);
            break;
        }
        applied++;
    } if (applied) {
        setStatus(applied + ' Bild(er) übernommen.');
        setSelected(current => current.slice(applied));
        if (applied === selected.length)
            await onApplied?.();
    } }); }
    function uploadFiles(files: FileList | null) { if (files?.[0] && onUpload) { void task(async () => { await onUpload(files[0]); }); return; } if (!files?.length || !profile)
        return; const queue = Array.from(files); void task(async () => { let done = 0; for (const file of queue) {
        const prepare = new FormData(), finish = new FormData();
        prepare.set('intent', 'prepare-library');
        finish.set('intent', 'library-upload');
        finish.set('file_name', file.name);
        const uploaded = await uploadPreparedAdminMedia(form => uploadLibrary(profile, form), file, prepare, finish, label => setStatus((done + 1) + '/' + queue.length + ' · ' + label));
        if (uploaded.error) {
            setError(file.name + ': ' + uploaded.error);
            break;
        }
        done++;
    } setStatus(done + ' Bild(er) in der Mediathek verfügbar.'); setKind(''); setQuery(''); setPage(1); reload(); }); }
    const currentName = profiles.find(p => p.id === profile)?.display_name ?? (profile ? 'Bilder dieses Unternehmens' : 'Alle Unternehmen');
    return <section ref={container} className={styles.library} aria-busy={busy || loading}>
 <header className={styles.header}><div><h2 id="media-library-title">Mediathek</h2><p>{currentName}</p></div>{onClose && <button type="button" className="button" disabled={busy} onClick={onClose}>Schließen</button>}</header>
 <div className={styles.filters}>
 <label>Medien in dieser Auswahl suchen<input type="search" autoFocus={Boolean(onClose)} maxLength={200} value={query} disabled={busy} onChange={e => { reset(); setQuery(e.target.value); }} placeholder="Name oder Bildbeschreibung"/></label>
 <MediaLibraryCompanyPicker searchCache={companyCache} value={profile} name={currentName} disabled={busy} onChange={company => { reset(); setProfile(company.id); setProfiles(current => [company, ...current.filter(p => p.id !== company.id)]); }}/>

 <label>Medienart<select value={kind} disabled={busy} onChange={e => { reset(); setKind(e.target.value); }}>{kinds.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
 <button type="button" className="button button-primary" disabled={busy || archived} onClick={() => onUpload ? upload.current?.click() : setUploadOpen(true)}>Medien hochladen</button>
 <input ref={upload} type="file" hidden multiple={!onUpload} accept="image/jpeg,image/png,image/webp" onChange={e => { uploadFiles(e.target.files); e.target.value = ''; }}/>
 </div>
 {onSelected && <div className={styles.options} aria-label="Bildquellen"><button type="button" className="button" disabled={busy} onClick={() => { reset(); setKind('banner'); setProfile(''); }}>Alle Werbebanner</button><button type="button" className="button" disabled={busy || !initialProfileId} onClick={() => { reset(); setKind(''); setProfile(initialProfileId!); }}>Unternehmensbilder</button><button type="button" className="button" disabled={busy} onClick={() => { reset(); setKind(''); setProfile(''); }}>Ganze Mediathek</button></div>}
 <div className={styles.options}><label><input type="checkbox" checked={archived} disabled={busy} onChange={e => { reset(); setArchived(e.target.checked); }}/> Archivierte Medien</label><span>JPG, PNG, WebP · maximal 5 MB nach Optimierung</span></div>
 {uploadOpen && <MediaLibraryUpload searchCache={companyCache} onBusy={active=>{setBusy(active);onBusy?.(active);}} profileId={profile} profileName={currentName} initialKind={target?.kind === 'video_block' ? 'video' : target?.kind ?? kind} onClose={()=>setUploadOpen(false)} onDone={(company,nextKind)=>{setProfile(company.id);setProfiles(current=>[company,...current.filter(p=>p.id!==company.id)]);setKind(nextKind);setSelected([]);setPage(1);reload();}}/>}
 {!profile && !onUpload && <p className={styles.hint}>Zum Hochladen ein Unternehmen auswählen. Unternehmen können Sie direkt in der Auswahl suchen.</p>}
 {error && <p role="alert" className={styles.error}>{error}</p>}{status && <p role="status">{status}</p>}
 {loading ? <p role="status" className={styles.empty}>Bilder werden geladen …</p> : !result.items.length ? <p className={styles.empty}>Keine Bilder gefunden.{profile && !archived ? ' Sie können Bilder direkt hier hochladen.' : ''}</p> : <div className={styles.grid}>
 {result.items.map(a => <article key={a.id} className={styles.card} data-selected={selected.some(s => s.id === a.id)}>
 <button className={styles.select} type="button" disabled={busy || archived || limit === 0 || (a.kind === 'video' ? Boolean(onSelected || target && target.kind !== 'video' && target.kind !== 'video_block') : target?.kind === 'video' || target?.kind === 'video_block')} aria-pressed={selected.some(s => s.id === a.id)} aria-label={a.name + ' auswählen'} onClick={() => toggle(a)}>
 <span className={styles.picture}>{a.kind === 'video' ? <span aria-label="Video">▶ Video</span> : a.src ? <Image src={a.src} alt={a.alt_text || a.name} fill sizes="(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 220px" unoptimized={a.bucket_id !== 'project-media'} loading="lazy"/> : <span>Vorschau nicht verfügbar</span>}</span>
 <strong>{a.name}</strong><small>{a.kind === 'video' ? 'Video · ' : ''}{a.profile_name || 'Werbebanner'} · {a.usages.length ? a.usages.length + ' Verwendung(en)' : 'Nicht verwendet'}</small>
 <span className={styles.check}>{selected.some(s => s.id === a.id) ? '✓ Ausgewählt' : 'Auswählen'}</span></button>
 <button type="button" className={styles.detailsButton} disabled={busy} onClick={e => { returnDetails.current = e.currentTarget; gridScroll.current = container.current?.scrollTop ?? 0; setDetails(a); setDimensions(''); }}>{a.kind==='video'?'Video abspielen & Details':'Details & Verwendung'}</button>
 </article>)}
 </div>}
 <nav className={styles.pagination} aria-label="Mediathek-Seiten"><button type="button" className="button" disabled={busy || loading || page === 1} onClick={() => { setLoading(true); setPage(p => p - 1); }}>← Zurück</button><span>Seite {page} von {Math.max(1, Math.ceil(result.count / MEDIA_LIBRARY_PAGE_SIZE))} · {result.count} Medien</span><button type="button" className="button" disabled={busy || loading || page * MEDIA_LIBRARY_PAGE_SIZE >= result.count} onClick={() => { setLoading(true); setPage(p => p + 1); }}>Weiter →</button></nav>
 {details && <aside className={styles.details} aria-label="Bilddetails">
 <header className={styles.header}><h3 ref={heading} tabIndex={-1}>Mediendetails</h3><button type="button" className="button" disabled={busy} onClick={closeDetails}>Details schließen</button></header>
 <div className={styles.detailBody}><div><div className={styles.picture}>{details.kind === 'video' ? <PortalVideo src={details.src} name={details.name} external={details.bucket_id === 'external-video'}/> : details.src ? <Image src={details.src} alt={details.alt_text || details.name} fill unoptimized sizes="350px" onLoad={e => { const image = e.currentTarget; setDimensions(image.naturalWidth + ' × ' + image.naturalHeight + ' Pixel'); }}/> : <span>Originaldatei bereits entfernt</span>}</div><p>{dimensions} · {details.storage_path.split('.').pop()?.toUpperCase()}</p><p>Original: {details.name}</p>{details.kind==='video' && <p>{details.bucket_id==='external-video'?'Externe Videoquelle':`${details.mime_type ?? 'Video'} · ${details.byte_size ? (details.byte_size / 1024 / 1024).toFixed(1) + ' MiB' : 'Größe nicht hinterlegt'}`}</p>}<h4>Verwendungen</h4>{details.usages.length ? <ul>{details.usages.map((u, i) => <li key={u.id + ':' + i}>{u.label}</li>)}</ul> : <p>Aktuell nicht verwendet.</p>}{details.bucket_id === 'project-media' && <p>Belegtes Projektoriginal. Die Originaldatei wird hier nicht verändert oder gelöscht; beim Einsetzen wird sie sicher in den privaten Profilbestand übernommen.</p>}{details.bucket_id === 'ad-media' && <p>Banneroriginale werden weiterhin ausschließlich in der bestehenden Bannerverwaltung entfernt. Hier werden keine Kampagnen verändert.</p>}<p>Bilddetails ändern nur den Katalog. Zuschnitt und Alt-Text bestehender Verwendungen bleiben erhalten.</p></div>
 <form key={details.id} onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void task(async () => { const r = await updateLibraryAsset(details.id, data); if (r.error)
            setError(r.error);
        else {
            setStatus(r.success ?? 'Gespeichert');
            closeDetails();
            setSelected(current => current.map(a => a.id === details.id ? { ...a, rights: r.rights ?? a.rights } : a));
            reload();
        } }); }}>
 {([['name', 'Name', 200], ['description', 'Bildbeschreibung', 2000], ['alt_text', 'Alt-Text für neue Verwendungen', 500], ['source', 'Quelle', 1000], ['rights', 'Dokumentierte Nutzungsrechte', 1000]] as const).map(([key, label, max]) => <label key={key}>{label}{key === 'description' ? <textarea name={key} rows={3} maxLength={max} defaultValue={details[key]} disabled={busy}/> : <input name={key} maxLength={max} required={key === 'name'} defaultValue={key === 'rights' ? readMediaRights(details.rights).license : details[key]} disabled={busy}/>}</label>)}
 <div className={styles.options}><button className="button button-primary" type="submit" disabled={busy}>Bilddetails speichern</button><button className="button" type="button" disabled={busy} onClick={() => void task(async () => { const r = await archiveLibraryAsset(details.id, !details.archived_at); if (r.error)
            setError(r.error);
        else {
            setStatus(r.success ?? 'Gespeichert');
            closeDetails();
            setSelected(current => current.filter(a => a.id !== details.id));
            reload();
        } })}>{details.archived_at ? 'Wieder verfügbar machen' : 'Im Katalog archivieren'}</button>
 {details.archived_at && details.bucket_id === 'company-media' && <button className="button" type="button" disabled={busy || details.usages.length > 0} onClick={() => { if (window.confirm('Originaldatei und kontrollierte Kopien endgültig löschen? Das ist nur ohne Verwendungen möglich und kann nicht rückgängig gemacht werden.'))
            void task(async () => { const r = await deleteLibraryAsset(details.id); if (r.error)
                setError(r.error);
            else {
                setStatus(r.success ?? 'Gelöscht');
                setDetails(null);
            } reload(); }); }}>Original endgültig löschen</button>}</div>
 </form></div></aside>}
 {(target || onSelected) && <footer className={styles.footer}><span>{selected.length} ausgewählt · {limit} {limit === 1 ? 'Bildplatz' : 'Bildplätze'} verfügbar. {onSelected ? 'Übernahme erst beim Speichern im Bannereditor.' : 'Änderungen werden direkt gespeichert.'}</span><div>{onClose && <button type="button" className="button" disabled={busy} onClick={onClose}>Abbrechen</button>}<button type="button" className="button button-primary" disabled={busy || loading || !selected.length || archived} onClick={useSelected}>{busy ? 'Wird gespeichert …' : limit > 1 ? 'Ausgewählte Bilder verwenden' : 'Ausgewähltes Bild verwenden'}</button></div></footer>}
 </section>;
}
