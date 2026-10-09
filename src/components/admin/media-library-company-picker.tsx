"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { searchLibraryProfiles } from '@/app/(energieheld)/admin/mediathek/actions';
import { companySearchCache } from '@/lib/media-library-company-cache';
import styles from './media-library.module.css';
type Company = { id: string; display_name: string };
export function MediaLibraryCompanyPicker({ value, name, disabled, onChange }: { value: string; name: string; disabled: boolean; onChange: (company: Company) => void }) {
    const id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [page, setPage] = useState(1), [items, setItems] = useState<Company[]>([]), [more, setMore] = useState(false), [waiting, setWaiting] = useState(true), [error, setError] = useState(''), [active, setActive] = useState(0), [returnFocus, setReturnFocus] = useState(false);
    useEffect(() => { if (!open && returnFocus) trigger.current?.focus({ preventScroll: true }); }, [open, returnFocus]);
    const [cache] = useState(() => companySearchCache(searchLibraryProfiles));
    const options = [{ id: '', display_name: 'Alle Unternehmen' }, ...items];
    useEffect(() => {
        if (!open) return;
        input.current?.focus({ preventScroll: true });
        const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);
    useEffect(() => {
        // Preload only the first bounded company page while the dialog opens.
        if (!open && (query || page !== 1)) return;
        let alive = true;
        const timer = setTimeout(() => { void cache.get(query, page).then(r => {
            if (!alive) return;
            setItems(r.items); setMore(r.more); setWaiting(false); setError(r.error ?? ''); setActive(0);
        }).catch(() => { if (alive) { setError('Unternehmen konnten nicht geladen werden.'); setWaiting(false); } }); }, cache.has(query, page) ? 0 : query ? 100 : 0);
        return () => { alive = false; clearTimeout(timer); };
    }, [open, query, page, cache]);
    function close() { setReturnFocus(true); setOpen(false); }
    function choose(company: Company) { onChange(company); close(); }
    function move(next: number) {
        const index = Math.max(0, Math.min(options.length - 1, next)); setActive(index);
        const list = root.current?.querySelector<HTMLElement>('[role=listbox]'), option = document.getElementById(id + '-option-' + index);
        if (list && option) { if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop; else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight; }
    }
    return <div className={styles.companyPicker} ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
        <span id={id + '-label'}>Unternehmen</span>
        <button ref={trigger} type="button" className={styles.companyTrigger} disabled={disabled} aria-labelledby={id + '-label ' + id + '-value'} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id + '-list' : undefined} onClick={() => { if (open) close(); else { setReturnFocus(false); setQuery(''); setPage(1); setWaiting(true); setOpen(true); } }} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setReturnFocus(false); setWaiting(true); setOpen(true); } }}><span id={id + '-value'}>{name}</span><span aria-hidden="true">⌄</span></button>
        {open && <div className={styles.companyMenu} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }}>
            <input ref={input} type="search" role="combobox" aria-label="Unternehmen suchen" aria-autocomplete="list" aria-expanded="true" aria-controls={id + '-list'} aria-activedescendant={!waiting ? id + '-option-' + active : undefined} placeholder="Unternehmen suchen …" value={query} maxLength={80} onChange={e => { setQuery(e.target.value); setPage(1); setWaiting(true); }} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!waiting) move(active + (e.key === 'ArrowDown' ? 1 : -1)); } else if (e.key === 'Enter') { e.preventDefault(); if (!waiting) choose(options[active]); } }} />
            {waiting && <p role="status">Unternehmen werden geladen …</p>}{error && <p role="alert">{error}</p>}
            <ul id={id + '-list'} role="listbox" aria-labelledby={id + '-label'} className={styles.companyList} aria-busy={waiting}>
                {!waiting && options.map((company, index) => <li key={company.id} id={id + '-option-' + index} role="option" aria-selected={company.id === value} data-active={index === active} onMouseMove={() => setActive(index)} onMouseDown={e => e.preventDefault()} onClick={() => choose(company)}>{company.display_name}</li>)}
            </ul>
            {!waiting && !items.length && <p role="status">Keine Unternehmen gefunden.</p>}
            <div className={styles.companyPages}><button type="button" disabled={waiting || page === 1} onClick={() => { setWaiting(true); setPage(p => p - 1); }}>Zurück</button><span>Seite {page}</span><button type="button" disabled={waiting || !more} onClick={() => { setWaiting(true); setPage(p => p + 1); }}>Weitere</button></div>
        </div>}
    </div>;
}
