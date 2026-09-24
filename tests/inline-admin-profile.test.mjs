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
      return { url: 'data:text/javascript,export function useRouter(){return {refresh(){}}};export function notFound(){throw Error("NOT_FOUND")};export function redirect(path){throw Error("REDIRECT:"+path)}', shortCircuit: true };
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

const { default: ExpertDetail } = await import("../src/app/(energieheld)/experten/[slug]/page.tsx");
const { checkInlineProfileTarget } = await import("../src/lib/inline-admin-profile.ts");
const { InlineProfileEditor } = await import("../src/components/admin/inline-profile-editor.tsx");
const { companyProfileListing } = await import("../src/lib/company-presentation.ts");
const { saveInlineProfile, saveInlineMedia } = await import("../src/app/(energieheld)/experten/[slug]/inline-actions.ts");
const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const publicProfile = {
  id: profileId, slug: "redaktionelle-firma", status: "approved", display_name: "Redaktionelle Firma",
  tagline: "Beratung vor Ort", description: "Öffentliche Beschreibung", business_areas: "Reiseberatung",
  phone: "030 12345", public_email: "kontakt@example.org", website: "https://example.org",
  street: "Musterstraße 1", postal_code: "10115", city: "Berlin", region: "Berlin", country: "Deutschland",
  logo_path: null, company_profile_images: [], company_profile_categories: [], company_quality_reviews: null,
  company_quality_requests: null, companies: { legal_name: "Redaktionelle Firma GmbH" },
};

function client({ authenticated = true, admin = true, slug = publicProfile.slug } = {}) {
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
        async maybeSingle() {
          if (table === "portal_admins") return { data: admin ? { user_id: "verified-user" } : null, error: null };
          if (call.payload) return { data: { id: profileId }, error: null };
          if (call.filters.some(([key, value]) => key === "slug" && value !== slug)) return { data: null, error: null };
          if (call.filters.some(([key, value]) => key === "id" && value !== profileId)) return { data: null, error: null };
          return { data: publicProfile, error: null };
        },
      };
    },
    storage: { from() { return {}; } },
  };
}

async function renderPage(options) {
  globalThis.__inlinePublicClient = client({ authenticated: false, admin: false });
  globalThis.__inlineAdminClient = client(options);
  const element = await ExpertDetail({ params: Promise.resolve({ slug: publicProfile.slug }) });
  return renderToStaticMarkup(element);
}

test("visitors and signed-in non-admins see the original public profile without editing controls", async () => {
  for (const options of [{ authenticated: false }, { authenticated: true, admin: false }]) {
    const html = await renderPage(options);
    assert.match(html, /Redaktionelle Firma/);
    assert.match(html, /Öffentliche Beschreibung/);
    assert.doesNotMatch(html, /Profil bearbeiten|Bearbeitungsmodus aktiv|Logo ändern|inline-admin-profile-form/);
    assert.ok(globalThis.__inlineAdminClient.calls.every((call) => call.table === "portal_admins"));
  }
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
    initialEditing: true,
  }));
  assert.match(html, /Bearbeitungsmodus aktiv/);
  assert.match(html, /Speichern/);
  assert.match(html, /Abbrechen/);
  for (const field of Object.keys(values)) assert.match(html, new RegExp(`name="${field}"`));
  assert.match(html, /Logo ändern/);
  assert.match(html, /Logo entfernen/);
  assert.match(html, /Bild hinzufügen/);
  assert.match(html, /Bild löschen/);
  assert.match(html, /Alt-Text speichern/);
  assert.doesNotMatch(html, /storage_path|profile_id|company_id|profiles\/aaaaaaaa/);
});
