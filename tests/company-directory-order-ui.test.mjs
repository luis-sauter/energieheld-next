import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (specifier === "next/cache") return { url: 'data:text/javascript,export function revalidatePath(path){globalThis.__orderRevalidated.push(path)}', shortCircuit: true };
    if (specifier === "next/navigation") return { url: 'data:text/javascript,export function useRouter(){return {refresh(){}}}', shortCircuit: true };
    if (specifier === "next/link" || specifier === "next/image") return { url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`, shortCircuit: true };
    if (specifier.endsWith(".module.css")) return { url: "data:text/javascript,export default {}", shortCircuit: true };
    if (specifier.endsWith("/supabase/server")) return { url: 'data:text/javascript,export async function createClient(){globalThis.__orderClientReads++;return globalThis.__orderClient}', shortCircuit: true };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/") ? new URL("../src/" + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
    }).outputText };
    return next(url, context);
  },
});

const { default: ExpertsPage } = await import("../src/app/(energieheld)/experten/page.tsx");
const { saveCompanyDirectoryOrder, saveSidebarOrder } = await import("../src/app/(energieheld)/experten/order-actions.ts");
const { DirectoryOrderEditor, DirectoryOrderRows } = await import("../src/components/admin/directory-order-editor.tsx");
const { SidebarOrderEditor, SidebarOrderSlots } = await import("../src/components/admin/sidebar-order-editor.tsx");
const { DirectoryEditModeProvider } = await import("../src/components/admin/directory-edit-mode.tsx");
const { listings } = await import("../src/data/listings.ts");
const { ListingRow } = await import("../src/components/portal/listing-row.tsx");
const { energieheld } = await import("../src/config/energieheld.ts");
const { filterListings } = await import("../src/lib/listings.ts");
const { sortByDirectoryOrder } = await import("../src/lib/company-directory-order.ts");
const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const realA = { ...listings[0], id: idA, isDemo: false, name: "Firma A", directoryPackage: undefined };
const realB = { ...listings[1], id: idB, isDemo: false, name: "Firma B", directoryPackage: undefined };

test("demo packages affect only row presentation, including filtered trade rows", () => {
  const renderRow = (listing) => renderToStaticMarkup(createElement(ListingRow, {
    listing, categories: energieheld.categories, href: `/experten/${listing.slug}`,
  }));
  assert.deepEqual(listings.filter((listing) => listing.directoryPackage === "premium").map((listing) => listing.slug),
    ["mueller-haustechnik", "sonnenwerk-oberland"]);
  assert.ok(listings.slice(2).every((listing) => listing.directoryPackage === "basic"));
  for (const listing of [realA, { ...listings[0], directoryPackage: undefined }, listings[2]]) {
    const html = renderRow(listing);
    assert.match(html, /listing-row--basic/);
    assert.doesNotMatch(html, /class="row-logo"/);
  }
  const premium = renderRow(listings[0]);
  assert.match(premium, /listing-row--premium|class="row-logo"/);
  assert.match(premium, /Unternehmensprofil|mailto:|tel:/);
  const filtered = filterListings([realA, listings[2], listings[1]],
    { query: "", category: "solar", location: "", service: "", sort: "" });
  assert.deepEqual(filtered.map((listing) => listing.slug), [realA.slug, listings[1].slug]);
  assert.match(renderRow(filtered[1]), /listing-row--premium/);
  const ordered = sortByDirectoryOrder([listings[0], listings[2], realA], [
    { item_key: `demo:${listings[2].slug}`, profile_id: null, sort_order: 0 },
    { item_key: `profile:${realA.id}`, profile_id: realA.id, sort_order: 1 },
    { item_key: `demo:${listings[0].slug}`, profile_id: null, sort_order: 2 },
  ]);
  assert.deepEqual(ordered.map((listing) => listing.name), [listings[2].name, realA.name, listings[0].name]);
});

function client({ signedIn = true, admin = false, rpcError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "user-1" } : null }, error: null }) },
    from(table) {
      calls.push({ table });
      return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: table === "portal_admins" && admin ? { user_id: "user-1" } : null, error: null }) };
    },
    rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; },
  };
}

test("visitors and signed-in non-admins have no reorder action; admin sees it only on unfiltered /experten", async () => {
  for (const options of [{ signedIn: false }, { signedIn: true, admin: false }]) {
    globalThis.__orderClient = client(options);
    globalThis.__orderClientReads = 0;
    const page = await ExpertsPage({ searchParams: Promise.resolve({}) });
    assert.equal(page.props.canReorder, false);
    assert.equal(page.props.saveOrder, undefined);
    assert.equal(page.props.saveSidebarOrder, undefined);
  }
  globalThis.__orderClient = client({ admin: true });
  const page = await ExpertsPage({ searchParams: Promise.resolve({}) });
  assert.equal(page.props.canReorder, true);
  assert.equal(page.props.saveOrder, saveCompanyDirectoryOrder);
  assert.equal(page.props.saveSidebarOrder, saveSidebarOrder);
  for (const key of ["q", "kategorie", "ort", "sort"]) {
    globalThis.__orderClientReads = 0;
    const filtered = await ExpertsPage({ searchParams: Promise.resolve({ [key]: "value" }) });
    assert.equal(filtered.props.canReorder, false);
    assert.equal(globalThis.__orderClientReads, 0);
  }
});

test("company editor initially renders real and demo listing rows without controls", () => {
  const html = renderToStaticMarkup(createElement(DirectoryEditModeProvider, null,
    createElement(DirectoryOrderEditor, { listings: [realA, listings[2], realB], saveOrder: async () => ({ success: "ok" }) })));
  assert.match(html, /Firmenreihenfolge bearbeiten/);
  assert.match(html, /Firma A/);
  assert.match(html, /Firma B/);
  assert.match(html, /Beispielprofil/);
  assert.doesNotMatch(html, /Reihenfolge speichern|Abbrechen|nach oben|nach unten|verschieben|Beispielprofil – nicht Teil/);
  assert.ok(html.indexOf("Firma A") < html.indexOf("Firma B"));
});

test("sidebar editor renders three empty slots and a separate admin entry", () => {
  const html = renderToStaticMarkup(createElement(DirectoryEditModeProvider, null,
    createElement(SidebarOrderEditor, { ads: [], slots: ["sidebar_middle", "sidebar_top", "sidebar_bottom"], saveOrder: async () => ({ success: "ok" }) })));
  assert.match(html, /Banner-Reihenfolge bearbeiten/);
  assert.equal((html.match(/Freier Werbeplatz/g) ?? []).length, 3);
  assert.ok(html.indexOf('data-placement="sidebar_middle"') < html.indexOf('data-placement="sidebar_top"'));
  assert.doesNotMatch(html, /top_banner|nach oben|nach unten|verschieben/);
});

test("active company editor gives demo rows the same drag and arrow controls as real rows", () => {
  const demo = listings[0];
  const html = renderToStaticMarkup(createElement(DirectoryOrderRows, {
    listings: [demo, listings[2], realA], editing: true, busy: false, dragged: null, target: null,
    onPointerDown() {}, onPointerMove() {}, onPointerUp() {}, onMove() {},
  }));
  assert.match(html, new RegExp(`data-directory-id="demo:${demo.slug}"`));
  assert.match(html, new RegExp(`Firma ${demo.name} verschieben`));
  assert.match(html, new RegExp(`Firma ${demo.name} nach unten`));
  assert.match(html, /Beispielprofil/);
  assert.match(html, /Firma Firma A verschieben/);
  assert.match(html, /listing-row--premium/);
  assert.match(html, /listing-row--basic/);
  assert.doesNotMatch(html, /nicht Teil der redaktionellen Reihenfolge/);
});

test("active sidebar editor gives all three empty slots drag and arrow controls", () => {
  const html = renderToStaticMarkup(createElement(SidebarOrderSlots, {
    ads: [], slots: ["sidebar_top", "sidebar_middle", "sidebar_bottom"], editing: true,
    busy: false, dragged: null, target: null,
    onPointerDown() {}, onPointerMove() {}, onPointerUp() {}, onMove() {},
  }));
  assert.equal((html.match(/Freier Werbeplatz/g) ?? []).length, 3);
  for (const label of ["Banner A", "Banner B", "Banner C"])
    for (const control of ["verschieben", "nach oben", "nach unten"])
      assert.match(html, new RegExp(`${label} ${control}`));
  assert.doesNotMatch(html, /top_banner/);
});

test("pointer previews and cancel paths cannot send a save request", () => {
  for (const path of ["src/components/admin/directory-order-editor.tsx", "src/components/admin/sidebar-order-editor.tsx"]) {
    const code = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    const pointer = code.split("function onPointerMove(")[1].split("function onPointerUp(")[0];
    const cancel = code.split("function cancel(")[1].split("async function save(")[0];
    assert.match(pointer, /setDraft/);
    assert.doesNotMatch(pointer + cancel, /saveOrder\(|\.rpc\(|fetch\(/);
    assert.equal((code.match(/await saveOrder\(/g) ?? []).length, 1);
  }
});

test("company action rechecks admin and sends one complete mixed payload to the new RPC", async () => {
  const keys = [`demo:${listings[0].slug}`, `profile:${idB}`, `profile:${idA}`];
  globalThis.__orderRevalidated = [];
  globalThis.__orderClient = client({ admin: false });
  assert.match((await saveCompanyDirectoryOrder(keys)).error, /nicht berechtigt/);
  assert.equal(globalThis.__orderClient.calls.some((call) => call.name), false);
  globalThis.__orderClient = client({ admin: true });
  for (const bad of [["not-an-id"], [`profile:${idA}`, `profile:${idA}`], ["demo:unknown"], "invalid"]) {
    assert.match((await saveCompanyDirectoryOrder(bad)).error, /ungültig/);
  }
  assert.equal(globalThis.__orderClient.calls.some((call) => call.name), false);
  assert.deepEqual(await saveCompanyDirectoryOrder(keys), { success: "Die Reihenfolge wurde gespeichert." });
  assert.deepEqual(globalThis.__orderClient.calls.filter((call) => call.name), [{ name: "reorder_company_directory_items", args: { p_item_keys: keys } }]);
  assert.ok(globalThis.__orderRevalidated.includes("/experten"));
  assert.ok(globalThis.__orderRevalidated.includes("/gewerke"));
  globalThis.__orderClient = client({ admin: true, rpcError: { message: "private database details" } });
  const failed = await saveCompanyDirectoryOrder(keys);
  assert.match(failed.error, /nicht gespeichert/);
  assert.doesNotMatch(failed.error, /private database details/);
});

test("sidebar action validates exact three slots, checks admin and sends one RPC", async () => {
  const slots = ["sidebar_bottom", "sidebar_top", "sidebar_middle"];
  globalThis.__orderRevalidated = [];
  globalThis.__orderClient = client({ admin: false });
  assert.match((await saveSidebarOrder(slots)).error, /nicht berechtigt/);
  globalThis.__orderClient = client({ admin: true });
  for (const bad of [null, slots.slice(1), [slots[0], slots[0], slots[2]], [slots[0], slots[1], "top_banner"]])
    assert.match((await saveSidebarOrder(bad)).error, /ungültig/);
  assert.equal(globalThis.__orderClient.calls.some((call) => call.name), false);
  assert.deepEqual(await saveSidebarOrder(slots), { success: "Die Banner-Reihenfolge wurde gespeichert." });
  assert.deepEqual(globalThis.__orderClient.calls.filter((call) => call.name), [{ name: "reorder_ad_sidebar_slots", args: { p_slots: slots } }]);
  assert.ok(globalThis.__orderRevalidated.includes("/experten"));
  assert.ok(globalThis.__orderRevalidated.includes("/gewerke"));
  globalThis.__orderClient = client({ admin: true, rpcError: { message: "private database details" } });
  assert.doesNotMatch((await saveSidebarOrder(slots)).error, /private database details/);
});
