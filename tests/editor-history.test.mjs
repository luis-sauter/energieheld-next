import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { EditorHistorySession, EDITOR_HISTORY_LIMIT, editorHistoryForm, editorShortcut } =
  await import("../src/lib/editor-history.ts");

const blockId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const imageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const text = (before, after) => ({ kind: "text", blockId, before, after });
function session() {
  const calls = [];
  const save = (target) => async (form) => {
    calls.push({ target, values: Object.fromEntries(form.entries()), ids: form.getAll(target === "image" ? "image_ids" : "block_ids") });
    return { success: "Gespeichert" };
  };
  return { history: new EditorHistorySession(save("content"), save("image")), calls };
}

test("only saved changes enter one capped session history; a fresh edit clears redo", async () => {
  const { history, calls } = session();
  history.record(text("A", "B"), false);
  assert.equal(history.snapshot.past.length, 0);
  history.record(text("A", "B"), true);
  history.record(text("B", "C"), true);
  assert.equal(history.snapshot.past.length, 2);
  await history.replay("undo");
  await history.replay("undo");
  assert.deepEqual(calls.map((item) => item.values.text), ["B", "A"]);
  await history.replay("redo");
  assert.equal(calls.at(-1).values.text, "B");
  history.record(text("B", "D"), true);
  assert.equal(history.snapshot.future.length, 0);
  for (let n = 0; n < EDITOR_HISTORY_LIMIT + 5; n++) history.record(text(String(n), String(n + 1)), true);
  assert.equal(history.snapshot.past.length, EDITOR_HISTORY_LIMIT);
  assert.equal(history.snapshot.past[0].before, "5");
});

test("layout, text alignment, spacing and block order replay through validated content intents", async () => {
  const { history, calls } = session();
  const before = { width_percent: 50, offset_percent: 25, text_align: "left", spacing_top: "normal", spacing_bottom: "normal" };
  const after = { width_percent: 75, offset_percent: 12.5, text_align: "right", spacing_top: "large", spacing_bottom: "small" };
  history.record({ kind: "layout", blockId, before, after }, true);
  await history.replay("undo");
  assert.deepEqual(calls.at(-1).values, { intent: "layout", block_id: blockId, width_percent: "50",
    offset_percent: "25", text_align: "left", spacing_top: "normal", spacing_bottom: "normal" });
  await history.replay("redo");
  assert.equal(calls.at(-1).values.text_align, "right");
  assert.equal(calls.at(-1).values.spacing_top, "large");
  assert.equal(calls.at(-1).values.spacing_bottom, "small");
  history.record({ kind: "block-order", before: ["A", "B", "C"], after: ["C", "A", "B"] }, true);
  await history.replay("undo");
  assert.deepEqual(calls.at(-1).ids, ["A", "B", "C"]);
  await history.replay("redo");
  assert.deepEqual(calls.at(-1).ids, ["C", "A", "B"]);
});

test("image layout, size, crop, caption and image order use only specific image actions", async () => {
  const { history, calls } = session();
  const entries = [
    { kind: "image-layout", blockId, before: 2, after: 4 },
    { kind: "image-size", blockId, before: { width_percent: 100, aspect_ratio: 1.5 }, after: { width_percent: 75, aspect_ratio: 1.2 } },
    { kind: "crop", blockId, imageId, before: { focus_x: 50, focus_y: 50, zoom: 1 }, after: { focus_x: 25, focus_y: 70, zoom: 1.5 } },
    { kind: "caption", blockId, imageId, before: "Alte Heizung", after: "Neue Wärmepumpe im Technikraum" },
    { kind: "image-order", blockId, before: ["A", "B", "C"], after: ["C", "A", "B"] },
  ];
  for (const entry of entries) {
    history.record(entry, true);
    await history.replay("undo");
    await history.replay("redo");
  }
  assert.deepEqual(calls.map((item) => item.target), Array(10).fill("image"));
  assert.deepEqual(calls.map((item) => item.values.intent), ["layout", "layout", "resize", "resize",
    "crop", "crop", "caption", "caption", "reorder", "reorder"]);
  assert.deepEqual([calls[4].values.focus_x, calls[4].values.focus_y, calls[4].values.zoom], ["50", "50", "1"]);
  assert.deepEqual([calls[5].values.focus_x, calls[5].values.focus_y, calls[5].values.zoom], ["25", "70", "1.5"]);
  assert.deepEqual([calls[6].values.caption, calls[7].values.caption], ["Alte Heizung", "Neue Wärmepumpe im Technikraum"]);
  assert.deepEqual(calls[8].ids, ["A", "B", "C"]);
  assert.deepEqual(calls[9].ids, ["C", "A", "B"]);
  assert.equal(editorHistoryForm(entries[2], "undo").form.has("storage_path"), false);
});

test("failed replay keeps its entry and double clicks cannot start parallel mutations", async () => {
  let complete;
  let calls = 0;
  const history = new EditorHistorySession(() => {
    calls++;
    return new Promise((resolve) => { complete = resolve; });
  }, async () => ({ success: "saved" }));
  history.record(text("A", "B"), true);
  const first = history.replay("undo");
  assert.equal(history.busy, true);
  assert.equal(await history.replay("undo"), null);
  assert.equal(calls, 1);
  complete({ error: "Serverfehler" });
  assert.deepEqual(await first, { error: "Serverfehler" });
  assert.equal(history.snapshot.past.length, 1);
  assert.equal(history.snapshot.future.length, 0);
  const second = history.replay("undo");
  complete({ success: "saved" });
  await second;
  assert.equal(history.snapshot.past.length, 0);
  assert.equal(history.snapshot.future.length, 1);
});

test("keyboard shortcuts leave text inputs native and ignore preview until saved", () => {
  assert.equal(editorShortcut("z", true, false, false, false, false), "undo");
  assert.equal(editorShortcut("Z", false, true, true, false, false), "redo");
  assert.equal(editorShortcut("y", true, false, false, false, false), "redo");
  assert.equal(editorShortcut("z", true, false, false, false, true), null);
  assert.equal(editorShortcut("z", false, false, false, false, false), null);
  const { history } = session();
  const preview = { kind: "crop", blockId, imageId, before: { focus_x: 50, focus_y: 50, zoom: 1 }, after: { focus_x: 25, focus_y: 70, zoom: 1.5 } };
  history.record(preview, false);
  assert.equal(history.snapshot.past.length, 0);
  history.record(preview, true);
  assert.equal(history.snapshot.past.length, 1);
  history.clear();
  assert.equal(history.snapshot.past.length, 0);
});
