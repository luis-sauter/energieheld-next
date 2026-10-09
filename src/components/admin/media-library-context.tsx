"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic.js";
import { useRouter } from "next/navigation";
import type { MediaLibraryTarget } from "@/lib/media-library";

const Browser = dynamic(() => import("./media-library-browser").then(m => m.MediaLibraryBrowser), { loading: () => <p role="status">Mediathek wird geladen …</p> });
type OpenTarget = Omit<MediaLibraryTarget, "profileId"> & {
  onApplied?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
};
const Context = createContext<{ open: (target: OpenTarget) => void } | null>(null);
export function useMediaLibrary() { return useContext(Context); }

export function MediaLibraryProvider({ profileId, profileName, children }: { profileId: string; profileName?: string; children: ReactNode }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const applied = useRef(false);
  const [target, setTarget] = useState<OpenTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function close() {
    if (busy) return;
    setBusy(true);
    try {
      // Never remove a newly used image if subsequent layout persistence failed.
      if (!applied.current) await target?.onCancel?.();
      dialog.current?.close();
    } catch {
      setError("Der neue Bildplatz konnte nicht entfernt werden. Bitte erneut versuchen.");
    } finally { setBusy(false); }
  }

  return <Context.Provider value={{ open(next) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    applied.current = false;
    setError("");
    setTarget(next);
    dialog.current?.showModal();
  } }}>
    {children}
    <dialog ref={dialog} className="media-library-dialog" aria-labelledby="media-library-title"
      onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); void close(); }}
      onClose={event => { if (event.target !== event.currentTarget) return; setTarget(null); returnFocus.current?.focus(); }}>
      {error && <p role="alert">{error}</p>}
      {target && <Browser initialProfileId={profileId} initialProfileName={profileName} initialKind={target.kind === "video" || target.kind === "video_block" ? "video" : target.kind} target={{ ...target, profileId }} onBusy={setBusy}
        onClose={close} onApplied={async () => {
          applied.current = true;
          await target.onApplied?.();
          dialog.current?.close();
          router.refresh();
        }} />}
    </dialog>
  </Context.Provider>;
}
