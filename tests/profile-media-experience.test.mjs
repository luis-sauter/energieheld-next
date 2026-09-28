import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

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
  assert.match(source("src/components/portal/company-image.tsx"), /objectFit: "cover"/);
  assert.match(gallery, /prefers-reduced-motion: reduce/);
  assert.match(gallery, /window\.setTimeout\([^]*?8000\)/);
});
