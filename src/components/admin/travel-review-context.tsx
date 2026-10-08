"use client";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import type { TravelReviewSnapshot, TravelSaveResult } from "@/lib/admin-travel-taxonomy";
import { sameTravelKeys } from "@/lib/travel-review-state";

type ReviewState = TravelReviewSnapshot & {
  selected: string[]; dirty: boolean; busy: boolean; saving: boolean;
  message: TravelSaveResult;
  toggle: (key: string) => void; save: () => void;
  setDeciding: (pending: boolean) => void;
};
const TravelReviewContext = createContext<ReviewState | null>(null);
export function useTravelReview() { return useContext(TravelReviewContext); }

export function TravelReviewProvider({ snapshot, saveAction, children }: {
  snapshot: TravelReviewSnapshot;
  saveAction: (selected: string[], expected: string[], proposals: string[], revision: number) => Promise<TravelSaveResult>;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(snapshot.assignedKeys);
  const [saved, setSaved] = useState(snapshot.assignedKeys);
  const [revision, setRevision] = useState(snapshot.revision);
  const [message, setMessage] = useState<TravelSaveResult>({});
  const [saving, startTransition] = useTransition();
  const [deciding, setDeciding] = useState(false);
  const dirty = !sameTravelKeys(selected, saved);
  function toggle(key: string) {
    if (saving || deciding) return;
    setMessage({});
    setSelected(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  }
  function save() {
    if (saving || deciding || !dirty || revision === undefined) return;
    setMessage({});
    startTransition(async () => {
      try {
        const result = await saveAction(selected, saved, snapshot.proposedKeys, revision);
        if (result.success && result.assignedKeys && result.revision !== undefined) {
          setSaved(result.assignedKeys); setSelected(result.assignedKeys); setRevision(result.revision);
        }
        setMessage(result);
      } catch { setMessage({ error: "Die Reisezuordnungen konnten nicht gespeichert werden. Bitte laden Sie die Profilprüfung neu." }); }
    });
  }
  return <TravelReviewContext value={{ ...snapshot, assignedKeys: saved, revision, selected, dirty, saving, busy: saving || deciding, message, toggle, save, setDeciding }}>{children}</TravelReviewContext>;
}
