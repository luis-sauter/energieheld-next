"use client";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import type { TravelReviewSnapshot, TravelSaveResult } from "@/lib/admin-travel-taxonomy";
import { useRouter } from "next/navigation";
import type { SeasonTeasers } from "@/lib/travel-seasons";
import { sameTravelKeys } from "@/lib/travel-review-state";

type ReviewState = TravelReviewSnapshot & {
  selected: string[]; dirty: boolean; busy: boolean; saving: boolean;
  message: TravelSaveResult;
  teasers: SeasonTeasers; setTeaser: (key: string, text: string) => void;
  toggle: (key: string) => void; save: () => void;
  setDeciding: (pending: boolean) => void; reset: () => void;
  persist: (expectedRevision?: number, refresh?: boolean) => Promise<TravelSaveResult>;
};
const TravelReviewContext = createContext<ReviewState | null>(null);
export function useTravelReview() { return useContext(TravelReviewContext); }

export function TravelReviewProvider({ snapshot, saveAction, children }: {
  snapshot: TravelReviewSnapshot;
  saveAction: (selected: string[], expected: string[], proposals: string[], revision: number, teasers?: SeasonTeasers) => Promise<TravelSaveResult>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(snapshot.assignedKeys);
  const [saved, setSaved] = useState(snapshot.assignedKeys);
  const [teasers, setTeasers] = useState(snapshot.seasonTeasers ?? {});
  const [savedTeasers, setSavedTeasers] = useState(snapshot.seasonTeasers ?? {});
  const [revision, setRevision] = useState(snapshot.revision);
  const [message, setMessage] = useState<TravelSaveResult>({});
  const [saving, startTransition] = useTransition();
  const [deciding, setDeciding] = useState(false);
  const currentTeasers = Object.fromEntries(Object.entries(teasers).filter(([key]) => selected.includes(key)));
  const teaserChanged = [...new Set([...Object.keys(currentTeasers), ...Object.keys(savedTeasers)])].some(key => (currentTeasers[key] ?? "") !== (savedTeasers[key] ?? ""));
  const dirty = !sameTravelKeys(selected, saved) || teaserChanged;
  const [received, setReceived] = useState(snapshot);
  if (received !== snapshot) {
    setReceived(snapshot);
    if (!dirty && !saving && snapshot.revision !== revision) {
      setSelected(snapshot.assignedKeys); setSaved(snapshot.assignedKeys); setRevision(snapshot.revision);
      setTeasers(snapshot.seasonTeasers ?? {}); setSavedTeasers(snapshot.seasonTeasers ?? {});
    }
  }
  function toggle(key: string) {
    if (saving || deciding) return;
    setMessage({});
    setSelected(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  }
  async function persist(expectedRevision = revision, refresh = true): Promise<TravelSaveResult> {
    if (saving || deciding || expectedRevision === undefined) return { error: "Bitte warten Sie oder laden Sie das Profil neu." };
    if (!dirty) return { assignedKeys: saved, revision: expectedRevision };
    setMessage({});
    try {
      const result = await saveAction(selected, saved, snapshot.proposedKeys, expectedRevision, currentTeasers);
      if (result.success && result.assignedKeys && result.revision !== undefined) {
        setSaved(result.assignedKeys); setSelected(result.assignedKeys); setRevision(result.revision);
        setTeasers(result.seasonTeasers ?? {}); setSavedTeasers(result.seasonTeasers ?? {});
        if (refresh) router.refresh();
      }
      setMessage(result); return result;
    } catch {
      const result = { error: "Die Reisezuordnungen konnten nicht gespeichert werden. Bitte laden Sie die Profilprüfung neu." };
      setMessage(result); return result;
    }
  }
  function save() {
    if (saving || deciding || !dirty || revision === undefined) return;
    setMessage({});
    startTransition(async () => { await persist(); });
  }
  return <TravelReviewContext value={{ ...snapshot, assignedKeys: saved, revision, teasers, setTeaser: (key, text) => { if (!saving && !deciding) setTeasers(current => ({ ...current, [key]: text })); }, selected, dirty, saving, busy: saving || deciding, message, toggle, save, persist, setDeciding, reset: () => { if (!saving && !deciding) { setSelected(saved); setTeasers(savedTeasers); setMessage({}); } } }}>{children}</TravelReviewContext>;
}
