import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/image") return { url: 'data:text/javascript,export default "img"', shortCircuit: true };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const url = specifier.startsWith("@/") ? new URL("../src/" + specifier.slice(2), import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(url.href + ext))) return next(url.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const optimizerSource = source("src/lib/client-image-optimization.ts")
  .replace('import { MEDIA_MAX_BYTES } from "./company-media";', "const MEDIA_MAX_BYTES = 5242880;");
const compiled = ts.transpileModule(optimizerSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { optimizeProfileImage, ORIGINAL_IMAGE_MAX_BYTES, PROFILE_IMAGE_MAX_EDGE } =
  await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

test("large photographs are oriented, resized and compressed before the existing 5 MB bucket upload", async () => {
  const oldBitmap = globalThis.createImageBitmap;
  const oldDocument = globalThis.document;
  let canvas;
  let orientation;
  globalThis.createImageBitmap = async (_file, options) => {
    orientation = options.imageOrientation;
    return { width: 4000, height: 3000, close() {} };
  };
  globalThis.document = { createElement: () => {
    canvas = { width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage() {} }),
      toBlob: (done, type) => done(new Blob([new Uint8Array(600_000)], { type })) };
    return canvas;
  } };
  try {
    const file = new File([new Uint8Array(6_000_000)], "photo.jpg", { type: "image/jpeg" });
    const optimized = await optimizeProfileImage(file);
    assert.equal(orientation, "from-image");
    assert.equal(canvas.width, PROFILE_IMAGE_MAX_EDGE);
    assert.equal(canvas.height, 1800);
    assert.equal(optimized.type, "image/jpeg");
    assert.ok(optimized.size < file.size && optimized.size <= 5242880);
  } finally {
    globalThis.createImageBitmap = oldBitmap;
    globalThis.document = oldDocument;
  }
});

test("PNG logos keep alpha and GIF/oversized originals fail before upload", async () => {
  const oldBitmap = globalThis.createImageBitmap;
  const oldDocument = globalThis.document;
  let alpha;
  globalThis.createImageBitmap = async () => ({ width: 3000, height: 1500, close() {} });
  globalThis.document = { createElement: () => ({
    getContext: (_kind, options) => { alpha = options.alpha; return { clearRect() {}, drawImage() {} }; },
    toBlob: (done, type) => done(new Blob([new Uint8Array(900_000)], { type })),
  }) };
  try {
    const optimized = await optimizeProfileImage(new File([new Uint8Array(6_000_000)], "logo.png", { type: "image/png" }));
    assert.equal(alpha, true);
    assert.equal(optimized.type, "image/png");
    await assert.rejects(() => optimizeProfileImage(new File(["GIF89a"], "animation.gif", { type: "image/gif" })), /JPG, PNG oder WebP/);
    await assert.rejects(() => optimizeProfileImage(new File([new Uint8Array(ORIGINAL_IMAGE_MAX_BYTES + 1)], "huge.jpg", { type: "image/jpeg" })), /30 MB/);
  } finally {
    globalThis.createImageBitmap = oldBitmap;
    globalThis.document = oldDocument;
  }
});

test("editor, directory and gallery keep local preview, square framing and reduced motion", () => {
  const layout = source("src/components/admin/inline-block-layout.tsx");
  const grid = source("src/components/admin/inline-image-grid-editor.tsx");
  const directory = source("src/app/globals.css");
  const gallery = source("src/components/portal/image-gallery.tsx");
  assert.match(layout, /setTextOverride\(\{ base: textAlign, value: values\.text_align/);
  assert.match(source("src/components/admin/inline-profile-editor.tsx"), /mapLocation=\{editing \? mapLocation : undefined\}/);
  assert.match(source("src/components/portal/listing-detail.tsx"), /googleMapsLocation\(location\)/);
  assert.match(layout, /data-spacing-top=\{previewSpacing\.top\}/);
  assert.match(grid, /data-columns=\{previewColumns\}/);
  assert.match(directory, /\.row-logo\s*\{[^}]*aspect-ratio:\s*1;/s);
  assert.match(source("src/components/portal/company-image.tsx"), /fit = "cover"/);
  assert.match(source("src/components/portal/company-image.tsx"), /objectFit: fit/);
  assert.match(gallery, /prefers-reduced-motion: reduce/);
  assert.match(gallery, /window\.setTimeout\(advance, 2000\)/);
});

test("public gallery advances after two seconds, resets on interaction and respects reduced motion", async () => {
  const { scheduleGalleryAdvance, galleryAutoplayEnabled } = await import("../src/components/portal/image-gallery.tsx");
  const oldWindow = globalThis.window;
  let nextId = 0;
  const pending = new Map();
  globalThis.window = { setTimeout(callback, delay) { const id = ++nextId; pending.set(id, { callback, delay }); return id; },
    clearTimeout(id) { pending.delete(id); } };
  try {
    let advances = 0;
    const cancel = scheduleGalleryAdvance(() => advances++);
    assert.equal(pending.get(1).delay, 2000);
    // A manual selection cancels the old countdown and starts a fresh one.
    cancel();
    assert.equal(pending.has(1), false);
    const again = scheduleGalleryAdvance(() => advances++);
    assert.equal(pending.get(2).delay, 2000);
    pending.get(2).callback();
    assert.equal(advances, 1);
    again();
    assert.equal(pending.size, 0);
    assert.equal(galleryAutoplayEnabled(true, false, false, 2), true);
    assert.equal(galleryAutoplayEnabled(true, true, false, 2), false);
    assert.equal(galleryAutoplayEnabled(true, false, true, 2), false);
    assert.equal(galleryAutoplayEnabled(true, false, false, 1), false);
  } finally { globalThis.window = oldWindow; }
});

test("square upload accepts non-square photos and keeps logo alpha with contain fit", async () => {
  const { squareMediaFile, SQUARE_MEDIA_SIZE } = await import("../src/lib/square-media.ts");
  const oldBitmap = globalThis.createImageBitmap;
  const oldDocument = globalThis.document;
  const draws = [];
  const alpha = [];
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close() {} });
  globalThis.document = { createElement: () => ({
    getContext(_name, options) { alpha.push(options.alpha); return { fillRect() {}, drawImage(...args) { draws.push(args); } }; },
    toBlob(done, type) { done(new Blob([new Uint8Array(2000)], { type })); },
  }) };
  try {
    const source = new File([new Uint8Array(1000)], "wide.png", { type: "image/png" });
    const logo = await squareMediaFile(source, "logo", { focus_x: 50, focus_y: 50, zoom: 1 });
    const photo = await squareMediaFile(source, "gallery", { focus_x: 50, focus_y: 50, zoom: 1 });
    assert.equal(SQUARE_MEDIA_SIZE, 400);
    assert.equal(logo.type, "image/png");
    assert.equal(photo.type, "image/jpeg");
    assert.deepEqual(alpha, [true, false]);
    assert.ok(draws[0][4] < SQUARE_MEDIA_SIZE, "logo fits within the square without cropping");
    assert.ok(draws[1][3] > SQUARE_MEDIA_SIZE, "photograph covers and crops the square");
  } finally { globalThis.createImageBitmap = oldBitmap; globalThis.document = oldDocument; }
});


test("contact preview/export use identical cover, focus and zoom without changing the source file", async () => {
  const { squareMediaFile } = await import("../src/lib/square-media.ts");
  const oldBitmap = globalThis.createImageBitmap, oldDocument = globalThis.document;
  let drawn, closed = false;
  globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() { closed = true; } });
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage(...args) { drawn = args.slice(1); } }), toBlob(done, type) { done(new Blob([new Uint8Array(2000)], { type })); } }) };
  try {
    const source = new File([new Uint8Array(1000)], "original.png", {type:"image/png"});
    const output = await squareMediaFile(source, "gallery", {focus_x:25,focus_y:75,zoom:1.5});
    assert.deepEqual(drawn, [-100, -150, 800, 600]);
    assert.equal(output.type, "image/jpeg");
    assert.equal(source.name, "original.png"); assert.equal(source.size, 1000); assert.equal(source.type, "image/png");
    assert.ok(closed);
  } finally { globalThis.createImageBitmap = oldBitmap; globalThis.document = oldDocument; }
});
