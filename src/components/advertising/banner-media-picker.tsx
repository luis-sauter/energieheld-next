"use client";
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic.js';
import { selectedBannerFile } from '@/lib/banner-media-selection';
const Browser = dynamic(() => import('../admin/media-library-browser').then(m => m.MediaLibraryBrowser), { loading: () => <p role="status">Mediathek wird geladen …</p> });
export function BannerMediaPicker({ profileId, profileName, onSelected, onClose }: { profileId?: string | null; profileName?: string; onSelected: (file: File) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), [busy, setBusy] = useState(false);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => previous?.focus({ preventScroll: true }); }, []);
  const accept = (file: File) => { if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size <= 0 || file.size > 5242880) throw Error('Bitte wählen Sie JPEG, PNG oder WebP mit maximal 5 MB.'); onSelected(file); onClose(); };
  return <dialog ref={dialog} className="media-library-dialog" aria-labelledby="media-library-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <Browser initialProfileId={profileId ?? undefined} initialProfileName={profileName} initialKind="banner" onClose={onClose} onBusy={setBusy} onSelected={async asset => accept(await selectedBannerFile(asset))} onUpload={accept} />
  </dialog>;
}
