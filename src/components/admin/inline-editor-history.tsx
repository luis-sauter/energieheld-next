"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorHistorySession, editorShortcut,
  EMPTY_EDITOR_HISTORY, type EditorHistoryEntry, type EditorHistoryState } from "@/lib/editor-history";

type Result = { error?: string; success?: string };
type Save = (form: FormData) => Promise<Result>;

export type InlineEditorHistory = {
  state: EditorHistoryState;
  busy: boolean;
  feedback: Result;
  record: (entry: EditorHistoryEntry, saved: boolean) => void;
  clear: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

export const InlineEditorHistoryContext = createContext<InlineEditorHistory | null>(null);

export function useInlineEditorHistory() {
  const history = useContext(InlineEditorHistoryContext);
  if (!history) throw new Error("Inline editor history is missing");
  return history;
}

export function useInlineEditorHistoryController(saveContent: Save, saveImage: Save, enabled: boolean): InlineEditorHistory {
  const router = useRouter();
  const [state, setState] = useState(EMPTY_EDITOR_HISTORY);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Result>({});
  const [session] = useState(() => {
    const created = new EditorHistorySession(saveContent, saveImage, () => {
      setState(created.snapshot);
      setBusy(created.busy);
    });
    return created;
  });
  useEffect(() => { session.setActions(saveContent, saveImage); }, [session, saveContent, saveImage]);

  function record(entry: EditorHistoryEntry, saved: boolean) {
    session.record(entry, saved);
    if (saved) setFeedback({});
  }
  function clear() { session.clear(); }
  async function replay(direction: "undo" | "redo") {
    if (!enabled || session.busy) return;
    setFeedback({});
    const result = await session.replay(direction);
    if (result?.success) {
      setFeedback({ success: direction === "undo" ? "Änderung rückgängig gemacht." : "Änderung wiederholt." });
      router.refresh();
    } else if (result) setFeedback({ error: result.error || "Die Änderung konnte nicht wiederhergestellt werden." });
  }
  async function undo() { await replay("undo"); }
  async function redo() { await replay("redo"); }

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const editingText = event.target instanceof Element && Boolean(event.target.closest("input, textarea, [contenteditable]"));
      const direction = editorShortcut(event.key, event.ctrlKey, event.metaKey, event.shiftKey, event.altKey, editingText);
      if (!direction) return;
      event.preventDefault();
      if (direction === "undo") void undo();
      else void redo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return { state, busy, feedback, record, clear, undo, redo };
}
