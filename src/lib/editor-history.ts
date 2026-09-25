import type { BlockLayout, TextAlignment } from "./content-block-layout";
import type { ImageCrop } from "./image-crop";

type Change<T> = { before: T; after: T };
type Layout = BlockLayout & { text_align?: TextAlignment };
type ImageSize = { width_percent: number; aspect_ratio: number };

export type EditorHistoryEntry =
  | ({ kind: "text"; blockId: string } & Change<string>)
  | ({ kind: "layout"; blockId: string } & Change<Layout>)
  | ({ kind: "block-order" } & Change<string[]>)
  | ({ kind: "image-layout"; blockId: string } & Change<number>)
  | ({ kind: "image-size"; blockId: string } & Change<ImageSize>)
  | ({ kind: "image-order"; blockId: string } & Change<string[]>)
  | ({ kind: "crop"; blockId: string; imageId: string } & Change<ImageCrop>)
  | ({ kind: "caption"; blockId: string; imageId: string } & Change<string | null>);

export type EditorHistoryState = { past: EditorHistoryEntry[]; future: EditorHistoryEntry[] };
export const EMPTY_EDITOR_HISTORY: EditorHistoryState = { past: [], future: [] };
export const EDITOR_HISTORY_LIMIT = 30;

export function addEditorHistory(state: EditorHistoryState, entry: EditorHistoryEntry): EditorHistoryState {
  if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) return state;
  return { past: [...state.past, entry].slice(-EDITOR_HISTORY_LIMIT), future: [] };
}

export function moveEditorHistory(state: EditorHistoryState, direction: "undo" | "redo"): EditorHistoryState {
  if (direction === "undo") {
    if (!state.past.length) return state;
    const entry = state.past.at(-1)!;
    return { past: state.past.slice(0, -1), future: [...state.future, entry] };
  }
  if (!state.future.length) return state;
  const entry = state.future.at(-1)!;
  return { past: [...state.past, entry], future: state.future.slice(0, -1) };
}

export function editorHistoryForm(entry: EditorHistoryEntry, direction: "undo" | "redo") {
  const value = direction === "undo" ? entry.before : entry.after;
  const form = new FormData();
  let target: "content" | "image" = "content";
  switch (entry.kind) {
    case "text":
      form.set("intent", "update"); form.set("block_id", entry.blockId); form.set("text", value as string);
      break;
    case "layout": {
      form.set("intent", "layout"); form.set("block_id", entry.blockId);
      const layout = value as Layout;
      for (const key of ["width_percent", "offset_percent", "spacing_top", "spacing_bottom"] as const)
        form.set(key, String(layout[key]));
      if (layout.text_align) form.set("text_align", layout.text_align);
      break;
    }
    case "block-order":
      form.set("intent", "reorder");
      for (const id of value as string[]) form.append("block_ids", id);
      break;
    case "image-layout":
      target = "image"; form.set("intent", "layout"); form.set("block_id", entry.blockId);
      form.set("columns", String(value));
      break;
    case "image-size": {
      target = "image"; form.set("intent", "resize"); form.set("block_id", entry.blockId);
      const size = value as ImageSize;
      form.set("width_percent", String(size.width_percent)); form.set("aspect_ratio", String(size.aspect_ratio));
      break;
    }
    case "image-order":
      target = "image"; form.set("intent", "reorder"); form.set("block_id", entry.blockId);
      for (const id of value as string[]) form.append("image_ids", id);
      break;
    case "crop": {
      target = "image"; form.set("intent", "crop"); form.set("block_id", entry.blockId);
      form.set("image_id", entry.imageId);
      const crop = value as ImageCrop;
      form.set("focus_x", String(crop.focus_x)); form.set("focus_y", String(crop.focus_y));
      form.set("zoom", String(crop.zoom));
      break;
    }
    case "caption":
      target = "image"; form.set("intent", "caption"); form.set("block_id", entry.blockId);
      form.set("image_id", entry.imageId); form.set("caption", (value as string | null) ?? "");
      break;
  }
  return { target, form };
}

export function editorShortcut(key: string, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean,
  altKey: boolean, editingText: boolean): "undo" | "redo" | null {
  if (!(ctrlKey || metaKey) || altKey || editingText) return null;
  const lower = key.toLowerCase();
  if (lower === "z") return shiftKey ? "redo" : "undo";
  if (lower === "y" && !shiftKey) return "redo";
  return null;
}

type SaveResult = { error?: string; success?: string };
type SaveAction = (form: FormData) => Promise<SaveResult>;

export class EditorHistorySession {
  private state: EditorHistoryState = EMPTY_EDITOR_HISTORY;
  private running = false;
  private saveContent: SaveAction;
  private saveImage: SaveAction;
  private changed: () => void;

  constructor(saveContent: SaveAction, saveImage: SaveAction, changed: () => void = () => {}) {
    this.saveContent = saveContent;
    this.saveImage = saveImage;
    this.changed = changed;
  }

  setActions(saveContent: SaveAction, saveImage: SaveAction) {
    this.saveContent = saveContent;
    this.saveImage = saveImage;
  }

  get snapshot() { return this.state; }
  get busy() { return this.running; }

  record(entry: EditorHistoryEntry, saved: boolean) {
    if (this.running || !saved) return;
    this.state = addEditorHistory(this.state, entry);
    this.changed();
  }

  clear() {
    if (this.running) return;
    this.state = EMPTY_EDITOR_HISTORY;
    this.changed();
  }

  async replay(direction: "undo" | "redo"): Promise<SaveResult | null> {
    if (this.running) return null;
    const entry = direction === "undo" ? this.state.past.at(-1) : this.state.future.at(-1);
    if (!entry) return null;
    this.running = true;
    this.changed();
    try {
      const { target, form } = editorHistoryForm(entry, direction);
      const result = await (target === "content" ? this.saveContent : this.saveImage)(form);
      if (result.success) this.state = moveEditorHistory(this.state, direction);
      return result;
    } catch {
      return { error: "Die Änderung konnte nicht wiederhergestellt werden. Bitte versuchen Sie es erneut." };
    } finally {
      this.running = false;
      this.changed();
    }
  }
}
