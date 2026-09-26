import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only" || specifier === "next/cache")
      return { url: 'data:text/javascript,export function revalidatePath(){}', shortCircuit: true };
    if (specifier === "next/navigation")
      return { url: 'data:text/javascript,export function useRouter(){return {refresh(){}}};export function notFound(){throw Error("NOT_FOUND")};export function redirect(path){throw Error("REDIRECT:"+path)};export const permanentRedirect=redirect', shortCircuit: true };
    if (specifier === "next/link" || specifier === "next/image")
      return { url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`, shortCircuit: true };
    if (specifier.endsWith(".module.css"))
      return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (specifier.endsWith("/supabase/public"))
      return { url: 'data:text/javascript,export function createPublicClient(){return globalThis.__inlinePublicClient}', shortCircuit: true };
    if (specifier.endsWith("/supabase/server"))
      return { url: 'data:text/javascript,export async function createClient(){return globalThis.__inlineAdminClient}', shortCircuit: true };
    if (specifier.endsWith("/leads/inquiry-dialog"))
      return { url: 'data:text/javascript,export function InquiryDialog(){return null}', shortCircuit: true };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const url = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(url.href + ext))) return next(url.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx"))
      return { format: "module", shortCircuit: true, source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText };
    return next(url, context);
  },
});

const { default: ExpertDetail } = await import("../src/app/(energieheld)/unterkuenfte/[slug]/page.tsx");
const { checkInlineProfileTarget } = await import("../src/lib/inline-admin-profile.ts");
const { InlineProfileEditor } = await import("../src/components/admin/inline-profile-editor.tsx");
const { InlineImageGridEditor } = await import("../src/components/admin/inline-image-grid-editor.tsx");
const { InlineEditorHistoryContext } = await import("../src/components/admin/inline-editor-history.tsx");
const { InlineImageCropEditor } = await import("../src/components/admin/inline-image-crop-editor.tsx");
const { ProfileContentBlocks } = await import("../src/components/portal/profile-content-blocks.tsx");
const { companyProfileListing } = await import("../src/lib/company-presentation.ts");
const { saveInlineProfile, saveInlineMedia } = await import("../src/app/(energieheld)/experten/[slug]/inline-actions.ts");
const { saveInlineContent } = await import("../src/app/(energieheld)/experten/[slug]/content-actions.ts");
const { saveInlineBlockImage } = await import("../src/app/(energieheld)/experten/[slug]/block-image-actions.ts");
const { demoProfileId, demoPublicSlug, demoSourceSlug, publicSlugForStoredProfile } = await import("../src/lib/reiseportal-demo.ts");
const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function renderGrid(props) {
  return renderToStaticMarkup(createElement(InlineEditorHistoryContext.Provider, {
    value: { state: { past: [], future: [] }, busy: false, feedback: {}, record() {}, clear() {}, undo: async () => {}, redo: async () => {} },
  }, createElement(InlineImageGridEditor, props)));
}
const publicProfile = {
  id: profileId, slug: "redaktionelle-firma", status: "approved", display_name: "Redaktionelle Firma",
  tagline: "Beratung vor Ort", description: "Öffentliche Beschreibung", business_areas: "Reiseberatung",
  phone: "030 12345", public_email: "kontakt@example.org", website: "https://example.org",
  street: "Musterstraße 1", postal_code: "10115", city: "Berlin", region: "Berlin", country: "Deutschland",
  logo_path: null, company_profile_images: [], company_profile_categories: [], company_quality_reviews: null,
  company_quality_requests: null, companies: { legal_name: "Redaktionelle Firma GmbH" },
};

function client({ authenticated = true, admin = true, profile = publicProfile, slug = profile.slug, contentRows = [] } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "verified-user" } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return {
        select(columns) { call.columns = columns; return this; },
        update(payload) { call.payload = payload; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        order() { return this; },
        then(resolve) { return resolve({ data: table === "profile_content_blocks" ? contentRows : [], error: null }); },
        async maybeSingle() {
          if (table === "portal_admins") return { data: admin ? { user_id: "verified-user" } : null, error: null };
          if (call.payload) return { data: { id: profile.id }, error: null };
          if (call.filters.some(([key, value]) => key === "slug" && value !== slug)) return { data: null, error: null };
          if (call.filters.some(([key, value]) => key === "id" && value !== profile.id)) return { data: null, error: null };
          return { data: profile, error: null };
        },
      };
    },
    storage: { from() { return { createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://media.example/${path}` })), error: null }) }; } },
  };
}

async function renderPage(options, contentRows = []) {
  globalThis.__inlinePublicClient = client({ authenticated: false, admin: false, contentRows });
  globalThis.__inlineAdminClient = client(options);
  const element = await ExpertDetail({ params: Promise.resolve({ slug: publicProfile.slug }) });
  return renderToStaticMarkup(element);
}

const demoProfile = {
  ...publicProfile,
  id: demoProfileId,
  slug: demoSourceSlug,
  display_name: "Energieheld Demo GmbH",
  tagline: "Photovoltaik",
  description: "Elektrotechnik und Energiesysteme",
  business_areas: "Gebäudetechnik",
  logo_path: `profiles/${demoProfileId}/logo/demo.png`,
  company_profile_images: [{
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    storage_path: `profiles/${demoProfileId}/gallery/demo.png`,
    alt_text: "Photovoltaik", sort_order: 0,
  }],
};
const demoBlocks = [{
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", profile_id: demoProfileId,
  type: "text", slot: null, sort_order: 0,
  content: { text: "Unsere Energiesysteme" },
}];

async function renderDemoPage({ authenticated = false, admin = false } = {}) {
  const publicClient = client({ authenticated: false, admin: false, profile: demoProfile });
  const adminClient = client({ authenticated, admin, profile: demoProfile, contentRows: demoBlocks });
  globalThis.__inlinePublicClient = publicClient;
  globalThis.__inlineAdminClient = adminClient;
  const element = await ExpertDetail({ params: Promise.resolve({ slug: demoPublicSlug }) });
  return { element, html: renderToStaticMarkup(element), publicClient, adminClient };
}

test("visitors and signed-in non-admins see the original public profile without editing controls", async () => {
  for (const options of [{ authenticated: false }, { authenticated: true, admin: false }]) {
    const html = await renderPage(options);
    assert.match(html, /Redaktionelle Firma/);
    assert.match(html, /Öffentliche Beschreibung/);
    assert.doesNotMatch(html, /Profil bearbeiten|Bearbeitungsmodus aktiv|Rückgängig|Wiederholen|Logo ändern|inline-admin-profile-form/);
    assert.ok(globalThis.__inlineAdminClient.calls.every((call) => call.table === "portal_admins"));
  }
});

test("published heading and text blocks render publicly without editorial controls or replacing existing content", async () => {
  const contentRows = [
    { id: "11111111-1111-4111-8111-111111111111", profile_id: profileId, type: "heading", slot: null, sort_order: 0, content: { text: "Unsere Leistungen" } },
    { id: "22222222-2222-4222-8222-222222222222", profile_id: profileId, type: "text", slot: null, sort_order: 1, content: { text: "Persönliche Reiseplanung" } },
    { id: "33333333-3333-4333-8333-333333333333", profile_id: profileId, type: "heading", slot: "about_heading", sort_order: 0, content: { text: "Über unser Team" } },
    { id: "44444444-4444-4444-8444-444444444444", profile_id: profileId, type: "heading", slot: "business_areas_heading", sort_order: 0, content: { text: "Unsere Tätigkeiten" } },
  ];
  for (const options of [{ authenticated: false }, { authenticated: true, admin: false }]) {
    const html = await renderPage(options, contentRows);
    for (const text of ["Über unser Team", "Öffentliche Beschreibung", "Unsere Leistungen", "Persönliche Reiseplanung", "Unsere Tätigkeiten", "Reiseberatung"])
      assert.match(html, new RegExp(text));
    assert.doesNotMatch(html, /Inhalt hinzufügen|Block löschen|Überschrift speichern|Profil bearbeiten/);
  }
  const visitor = await renderPage({ authenticated: false }, contentRows);
  const admin = await renderPage({ authenticated: true, admin: true }, contentRows);
  assert.equal(admin.replace(/<button type="button"[^>]*>Profil bearbeiten<\/button>/, ""), visitor);
});

test("inline save ignores forged form IDs and updates only the displayed profile", async () => {
  const db = client();
  globalThis.__inlineAdminClient = db;
  const form = new FormData();
  for (const field of ["display_name", "tagline", "description", "business_areas", "phone", "public_email", "website", "street", "postal_code", "city", "region"])
    form.set(field, publicProfile[field] ?? "");
  form.set("display_name", "Geänderter Name");
  form.set("profile_id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  form.set("slug", "fremdes-profil");
  form.set("status", "rejected");
  const result = await saveInlineProfile(profileId, publicProfile.slug, form);
  assert.ok(result.success);
  const update = db.calls.find((call) => call.payload);
  assert.deepEqual(update.filters, [["id", profileId]]);
  assert.equal(update.payload.display_name, "Geänderter Name");
  assert.equal(update.payload.slug, undefined);
  assert.equal(update.payload.status, undefined);
  assert.equal(update.payload.profile_id, undefined);
  const foreign = await saveInlineProfile("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", publicProfile.slug, form);
  assert.ok(foreign.error);
  assert.equal(db.calls.filter((call) => call.payload).length, 1);
});

test("inline media still uses the existing admin prepare mutation with displayed profile scope", async () => {
  const db = client();
  globalThis.__inlineAdminClient = db;
  const form = new FormData();
  form.set("intent", "prepare-gallery");
  form.set("file_type", "image/png");
  form.set("file_size", "128");
  const result = await saveInlineMedia(profileId, publicProfile.slug, form);
  assert.match(result.uploadPath, new RegExp(`^profiles/${profileId}/gallery/`));
  const wrong = await saveInlineMedia("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", publicProfile.slug, form);
  assert.ok(wrong.error);
  assert.equal(db.calls.filter((call) => call.table === "company_profiles" && call.columns?.includes("logo_path")).length, 1);
});

test("verified portal admin gets the entry point while the public view stays unchanged until edit mode", async () => {
  const visitor = await renderPage({ authenticated: false });
  const admin = await renderPage({ authenticated: true, admin: true });
  assert.match(admin, /Profil bearbeiten/);
  assert.doesNotMatch(admin, /Bearbeitungsmodus aktiv|Logo ändern|Alt-Text speichern|inline-admin-profile-form/);
  assert.equal(admin.replace(/<button type="button"[^>]*>Profil bearbeiten<\/button>/, ""), visitor);
});

test("Demo uses its real Supabase media and blocks for the admin editor while public views stay neutral", async () => {
  const visitor = await renderDemoPage();
  for (const options of [{ authenticated: false }, { authenticated: true, admin: false }]) {
    const { html, adminClient } = await renderDemoPage(options);
    assert.match(html, /Demo GmbH|Demo\/Testprofil/);
    assert.match(html, /Google Maps/);
    assert.match(html, /class="gallery"/);
    assert.doesNotMatch(html, /Profil bearbeiten|Energieheld|Photovoltaik|Elektrotechnik|Energiesysteme|Gebäudetechnik/);
    assert.ok(adminClient.calls.every((call) => call.table === "portal_admins"));
  }
  const { element, html, adminClient } = await renderDemoPage({ authenticated: true, admin: true });
  assert.match(html, /Profil bearbeiten/);
  assert.equal(html.replace(/<button type="button"[^>]*>Profil bearbeiten<\/button>/, ""), visitor.html);
  assert.doesNotMatch(html, /Energieheld|Photovoltaik|Elektrotechnik|Energiesysteme|Gebäudetechnik|Bearbeitungsmodus aktiv/);
  const editor = element.props.children.find((child) => child?.type === InlineProfileEditor);
  assert.ok(editor);
  assert.equal(editor.props.listing.id, demoProfileId);
  assert.equal(editor.props.values.display_name, demoProfile.display_name);
  assert.deepEqual(editor.props.contentBlocks, demoBlocks);
  assert.deepEqual(editor.props.publicContentBlocks, []);
  assert.equal(editor.props.media.images.length, 1);
  assert.equal(editor.props.allowDemoMap, true);
  assert.ok(adminClient.calls.some((call) => call.table === "profile_content_blocks"));

  const editing = renderToStaticMarkup(createElement(InlineProfileEditor, { ...editor.props, initialEditing: true }));
  assert.match(editing, /Bearbeitungsmodus aktiv|Rückgängig|Wiederholen/);
  assert.match(editing, /Unsere Energiesysteme|Logo ändern|Bild löschen|Speichern/);
});

test("static legacy previews never receive the admin editor or a profile mutation target", async () => {
  globalThis.__inlineAdminClient = client({ authenticated: true, admin: true, profile: demoProfile });
  const element = await ExpertDetail({ params: Promise.resolve({ slug: "bayerischer-wald" }) });
  const html = renderToStaticMarkup(element);
  assert.doesNotMatch(html, /Profil bearbeiten|Bearbeitungsmodus aktiv/);
  assert.equal(globalThis.__inlineAdminClient.calls.length, 0);
});

test("inline mutations require matching displayed ID, slug and approved state after admin auth", async () => {
  for (const options of [{ authenticated: false }, { authenticated: true, admin: false }]) {
    const db = client(options);
    const result = await checkInlineProfileTarget(db, profileId, publicProfile.slug);
    assert.notEqual(result.access, "admin");
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
  const db = client();
  assert.ok((await checkInlineProfileTarget(db, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", publicProfile.slug)).error);
  assert.ok((await checkInlineProfileTarget(db, profileId, "other-profile")).error);
  const result = await checkInlineProfileTarget(db, profileId, publicProfile.slug);
  assert.equal(result.access, "admin");
  assert.equal(result.error, undefined);
  const targetCall = db.calls.at(-1);
  assert.deepEqual(targetCall.filters, [["id", profileId], ["slug", publicProfile.slug], ["status", "approved"]]);
});

test("the public Demo alias authorizes only its exact stored profile after admin verification", async () => {
  const demoProfile = { ...publicProfile, id: demoProfileId, slug: demoSourceSlug };
  assert.equal(publicSlugForStoredProfile(demoProfile), demoPublicSlug);
  assert.equal(publicSlugForStoredProfile(publicProfile), publicProfile.slug);
  const db = client({ profile: demoProfile });
  const target = await checkInlineProfileTarget(db, demoProfileId, demoPublicSlug);
  assert.equal(target.access, "admin");
  assert.equal(target.error, undefined);
  assert.deepEqual(db.calls.at(-1).filters, [["id", demoProfileId], ["slug", demoSourceSlug], ["status", "approved"]]);
  const callsBeforeForgery = db.calls.length;
  assert.ok((await checkInlineProfileTarget(db, profileId, demoPublicSlug)).error);
  assert.equal(db.calls.length, callsBeforeForgery + 1); // Admin check only; no profile query.
  const guest = client({ authenticated: false, profile: demoProfile });
  assert.equal((await checkInlineProfileTarget(guest, demoProfileId, demoPublicSlug)).access, "unauthenticated");
  assert.ok(guest.calls.every((call) => call.table === "portal_admins"));

  globalThis.__inlineAdminClient = db;
  const profileForm = new FormData();
  for (const field of ["display_name", "tagline", "description", "business_areas", "phone", "public_email", "website", "street", "postal_code", "city", "region"])
    profileForm.set(field, demoProfile[field] ?? "");
  profileForm.set("profile_id", profileId);
  assert.ok((await saveInlineProfile(demoProfileId, demoPublicSlug, profileForm)).success);
  const update = db.calls.find((call) => call.payload);
  assert.deepEqual(update.filters, [["id", demoProfileId]]);
  assert.equal(update.payload.profile_id, undefined);
  assert.ok((await saveInlineProfile(profileId, demoPublicSlug, profileForm)).error);
  assert.equal(db.calls.filter((call) => call.payload).length, 1);

  const mediaForm = new FormData();
  mediaForm.set("intent", "prepare-gallery");
  mediaForm.set("file_type", "image/png");
  mediaForm.set("file_size", "128");
  assert.match((await saveInlineMedia(demoProfileId, demoPublicSlug, mediaForm)).uploadPath, new RegExp(`^profiles/${demoProfileId}/gallery/`));
  assert.match((await saveInlineContent(demoProfileId, demoPublicSlug, new FormData())).error, /Inhaltsblock gehört nicht/);
  assert.match((await saveInlineBlockImage(demoProfileId, demoPublicSlug, new FormData())).error, /Bildblock oder das Bild gehört nicht/);
});

test("inline mode exposes normal fields and existing media actions in the public layout", () => {
  const imageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const media = { logo: { src: "https://example.org/logo.png", alt: "Logo" }, images: [{ id: imageId, src: "https://example.org/gallery.png", alt: "Galeriebild" }] };
  const listing = companyProfileListing(publicProfile, media);
  const values = Object.fromEntries([
    "display_name", "tagline", "description", "business_areas", "phone", "public_email",
    "website", "street", "postal_code", "city", "region",
  ].map((field) => [field, publicProfile[field] ?? ""]));
  const html = renderToStaticMarkup(createElement(InlineProfileEditor, {
    listing, categories: [], values, media,
    rows: [{ id: imageId, storage_path: `profiles/${profileId}/gallery/image.png`, alt_text: "Galeriebild", sort_order: 0 }],
    saveProfile: async () => ({ success: "Gespeichert" }), saveMedia: async () => ({ success: "Gespeichert" }),
    contentBlocks: [{ id: imageId, profile_id: profileId, type: "heading", slot: null, sort_order: 0, content: { text: "Unsere Leistungen" } }],
    contentAvailable: true, saveContent: async () => ({ success: "Gespeichert" }),
    initialEditing: true,
  }));
  assert.match(html, /Bearbeitungsmodus aktiv/);
  assert.match(html, /↶ Rückgängig/);
  assert.match(html, /↷ Wiederholen/);
  assert.match(html, /Speichern/);
  assert.match(html, /Abbrechen/);
  for (const field of Object.keys(values)) assert.match(html, new RegExp(`name="${field}"`));
  assert.match(html, /Logo ändern/);
  assert.match(html, /Logo entfernen/);
  assert.match(html, /Bild hinzufügen/);
  assert.match(html, /Bild löschen/);
  assert.match(html, /Alt-Text speichern/);
  assert.match(html, /Überschrift speichern/);
  assert.match(html, /fixed-about_heading/);
  assert.match(html, /fixed-business_areas_heading/);
  assert.match(html, /\+ Inhalt hinzufügen/);
  assert.match(html, /Duplizieren/);
  assert.match(html, /Löschen/);
  assert.doesNotMatch(html, /storage_path|profile_id|company_id|profiles\/aaaaaaaa/);
});

test("editor renders one visible slot per chosen column, including partially filled grids", () => {
  const imageBlock = (columns, count) => ({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", profile_id: profileId,
    type: "image_grid", slot: null, sort_order: 0, content: {},
    config: { columns, width_percent: 100, aspect_ratio: 1.5 },
    images: Array.from({ length: count }, (_, index) => ({
      id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, "0")}`,
      block_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      src: `https://example.org/${index}.jpg`, alt_text: `Bild ${index}`,
      sort_order: index,
    })),
  });
  for (const columns of [1, 2, 3, 4]) {
    const html = renderGrid({
      block: imageBlock(columns, 0), saveAction: async () => ({ success: "Gespeichert" }),
    });
    assert.equal((html.match(/\+ Bild hinzufügen/g) ?? []).length, columns);
    assert.match(html, new RegExp(`data-columns="${columns}"`));
  }
  for (const [count, empty] of [[1, 3], [3, 1]]) {
    const html = renderGrid({
      block: imageBlock(4, count), saveAction: async () => ({ success: "Gespeichert" }),
    });
    assert.equal((html.match(/<img/g) ?? []).length, count);
    assert.equal((html.match(/\+ Bild hinzufügen/g) ?? []).length, empty);
  }
});

test("visitors see only occupied images stretched across the available grid", () => {
  const block = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", profile_id: profileId,
    type: "image_grid", slot: null, sort_order: 0, content: {},
    config: { columns: 4, width_percent: 70, aspect_ratio: 1.2 },
    images: [0, 1].map((index) => ({
      id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, "0")}`,
      block_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      src: `https://example.org/${index}.jpg`, alt_text: `Bild ${index}`, sort_order: index,
    })),
  };
  const html = renderToStaticMarkup(createElement(ProfileContentBlocks, { blocks: [block] }));
  assert.match(html, /data-columns="2"/);
  assert.match(html, /width:70%/);
  assert.equal((html.match(/<img/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Bild hinzufügen|Bild ersetzen|Bild löschen|Bildblockgröße/);
  const empty = renderToStaticMarkup(createElement(ProfileContentBlocks, {
    blocks: [{ ...block, images: [] }],
  }));
  assert.equal(empty, "");
});

test("four visible captions stay directly under their own public image without duplicate alt text", () => {
  const block = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", profile_id: profileId,
    type: "image_grid", slot: null, sort_order: 0, content: {}, config: { columns: 4, aspect_ratio: 1.5 },
    images: [1, 2, 3, 4].map((n) => ({
      id: `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`,
      block_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", src: `https://example.org/${n}.jpg`,
      alt_text: `Bild ${n}`, caption: `Text ${n}`, sort_order: n - 1,
    })),
  };
  const html = renderToStaticMarkup(createElement(ProfileContentBlocks, { blocks: [block] }));
  assert.equal((html.match(/<figure/g) ?? []).length, 4);
  assert.equal((html.match(/<figcaption/g) ?? []).length, 4);
  for (const n of [1, 2, 3, 4]) assert.match(html,
    new RegExp(`<img[^>]+src="https://example.org/${n}\\.jpg"[^>]*alt=""[^>]*>.*?<figcaption[^>]*>Text ${n}</figcaption>`));
  const without = renderToStaticMarkup(createElement(ProfileContentBlocks, { blocks: [{ ...block,
    images: [{ ...block.images[0], caption: "" }, { ...block.images[1], caption: null }],
  }] }));
  assert.doesNotMatch(without, /<figcaption/);
  assert.match(without, /alt="Bild 1"/);
  assert.match(without, /alt="Bild 2"/);
  const editor = renderGrid({ block, saveAction: async () => ({ success: "Gespeichert" }) });
  assert.match(editor, /Text unter dem Bild/);
  assert.match(editor, /Text speichern/);
  assert.doesNotMatch(editor, /Bildbeschreibung \(Alt-Text\)/);
});

test("legacy image config renders with defaults before the resize migration", () => {
  const block = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", profile_id: profileId,
    type: "image_grid", slot: null, sort_order: 0, content: {}, config: { columns: 2 },
    images: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", block_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      src: "https://example.org/image.jpg", alt_text: "Ansicht", sort_order: 0 }],
  };
  const publicHtml = renderToStaticMarkup(createElement(ProfileContentBlocks, { blocks: [block] }));
  assert.match(publicHtml, /width:100%/);
  assert.match(publicHtml, /data-columns="1"/);
  const editorHtml = renderGrid({
    block, saveAction: async () => ({ success: "Gespeichert" }),
  });
  assert.equal((editorHtml.match(/\+ Bild hinzufügen/g) ?? []).length, 1);
  assert.doesNotMatch(editorHtml, /Bildblockgröße durch Ziehen ändern/);
});

test("public blocks use the full canvas and keep block position separate from text alignment", async () => {
  const rows = [{
    id: "11111111-1111-4111-8111-111111111111", profile_id: profileId,
    type: "heading", slot: null, sort_order: 0, content: { text: "Zentrierter Titel" },
    config: { width_percent: 50, offset_percent: 25, text_align: "center", spacing_top: "large", spacing_bottom: "small" },
  }, {
    id: "22222222-2222-4222-8222-222222222222", profile_id: profileId,
    type: "text", slot: null, sort_order: 1, content: { text: "Links im rechten Block" },
    config: { width_percent: 50, offset_percent: 50, text_align: "left", spacing_top: "normal", spacing_bottom: "normal" },
  }];
  const html = await renderPage({ authenticated: false }, rows);
  assert.match(html, /profile-content-canvas/);
  assert.match(html, /style="width:50%;margin-left:25%;text-align:center"/);
  assert.match(html, /style="width:50%;margin-left:50%;text-align:left"/);
  assert.match(html, /data-spacing-top="large" data-spacing-bottom="small"/);
  assert.ok(html.indexOf("profile-content-canvas") > html.indexOf("Öffentliche Beschreibung"));
  assert.doesNotMatch(html, /Block horizontal ziehen|Duplizieren|Breite 50 %/);
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.company-profile \.profile-content-canvas \.profile-content-block \{[\s\S]*max-width: 100%/);
});

test("public, inline grid and large crop preview share the same saved image framing", () => {
  const image = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    block_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", src: "https://example.org/photo.jpg",
    alt_text: "Person", sort_order: 0, focus_x: 20, focus_y: 70, zoom: 1.8 };
  const block = { id: image.block_id, profile_id: profileId, type: "image_grid", slot: null,
    sort_order: 0, content: {}, config: { columns: 1, width_percent: 100, aspect_ratio: 1.5 }, images: [image] };
  const publicHtml = renderToStaticMarkup(createElement(ProfileContentBlocks, { blocks: [block] }));
  const editHtml = renderGrid({
    block, saveAction: async () => ({ success: "Gespeichert" }),
  });
  const cropHtml = renderToStaticMarkup(createElement(InlineImageCropEditor, {
    image, ratio: 1.5, save: async () => true, cancel: () => {},
  }));
  for (const html of [publicHtml, editHtml, cropHtml]) {
    assert.match(html, /object-position:20% 70%/);
    assert.match(html, /transform:scale\(1\.8\)/);
    assert.match(html, /transform-origin:20% 70%/);
  }
  assert.doesNotMatch(publicHtml, /Ausschnitt bearbeiten|Zoom|Übernehmen|Zurücksetzen/);
  assert.match(editHtml, /Ausschnitt bearbeiten/);
  assert.match(cropHtml, /Bildzoom|Zoom verringern|Zoom erhöhen|Zentrieren|Zurücksetzen|Übernehmen|Abbrechen/);
  assert.match(cropHtml, /Bild nach links|Bild nach rechts|Bild nach oben|Bild nach unten/);
  assert.match(cropHtml, /aspect-ratio:1\.5/);
});

test("old image rows keep public rendering and disable crop until migration is available", () => {
  const image = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    block_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", src: "https://example.org/photo.jpg",
    alt_text: "Ansicht", sort_order: 0 };
  const block = { id: image.block_id, profile_id: profileId, type: "image_grid", slot: null,
    sort_order: 0, content: {}, config: { columns: 1 }, images: [image] };
  const publicHtml = renderToStaticMarkup(createElement(ProfileContentBlocks, { blocks: [block] }));
  const editHtml = renderGrid({
    block, saveAction: async () => ({ success: "Gespeichert" }),
  });
  assert.match(publicHtml, /object-position:50% 50%/);
  assert.match(publicHtml, /transform:scale\(1\)/);
  assert.match(editHtml, /title="Nach Datenbankaktualisierung verfügbar"/);
  assert.match(editHtml, /Ausschnitt nach Datenbankaktualisierung verfügbar/);
  assert.match(editHtml, /Ausschnitt bearbeiten/);
});
