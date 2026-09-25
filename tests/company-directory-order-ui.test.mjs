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
const { saveCompanyDirectoryOrder } = await import("../src/app/(energieheld)/experten/order-actions.ts");
const { DirectoryOrderEditor } = await import("../src/components/admin/directory-order-editor.tsx");
const { listings } = await import("../src/data/listings.ts");
const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const realA = { ...listings[0], id: idA, isDemo: false, name: "Firma A" };
const realB = { ...listings[1], id: idB, isDemo: false, name: "Firma B" };

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
  }
  globalThis.__orderClient = client({ admin: true });
  const page = await ExpertsPage({ searchParams: Promise.resolve({}) });
  assert.equal(page.props.canReorder, true);
  assert.equal(page.props.saveOrder, saveCompanyDirectoryOrder);
  for (const key of ["q", "kategorie", "ort", "sort"]) {
    globalThis.__orderClientReads = 0;
    const filtered = await ExpertsPage({ searchParams: Promise.resolve({ [key]: "value" }) });
    assert.equal(filtered.props.canReorder, false);
    assert.equal(globalThis.__orderClientReads, 0);
  }
});

test("editor initially renders ordinary listing rows and a single admin entry, without drag controls", () => {
  const html = renderToStaticMarkup(createElement(DirectoryOrderEditor, { listings: [realA, realB, listings[2]], saveOrder: async () => ({ success: "ok" }) }));
  assert.match(html, /Reihenfolge bearbeiten/);
  assert.match(html, /Firma A/);
  assert.match(html, /Firma B/);
  assert.doesNotMatch(html, /Reihenfolge speichern|Abbrechen|nach oben|nach unten|verschieben|Beispielprofil – nicht Teil/);
  assert.ok(html.indexOf("Firma A") < html.indexOf("Firma B"));
});

test("server action rechecks admin and validates complete UUID-shaped payload before one RPC", async () => {
  globalThis.__orderRevalidated = [];
  globalThis.__orderClient = client({ admin: false });
  assert.match((await saveCompanyDirectoryOrder([idA, idB])).error, /nicht berechtigt/);
  assert.equal(globalThis.__orderClient.calls.some((call) => call.name), false);
  globalThis.__orderClient = client({ admin: true });
  for (const bad of [["not-an-id"], [idA, idA], "invalid"]) {
    assert.match((await saveCompanyDirectoryOrder(bad)).error, /ungültig/);
  }
  assert.equal(globalThis.__orderClient.calls.some((call) => call.name), false);
  assert.deepEqual(await saveCompanyDirectoryOrder([idB, idA]), { success: "Die Reihenfolge wurde gespeichert." });
  assert.deepEqual(globalThis.__orderClient.calls.filter((call) => call.name), [{ name: "reorder_company_directory_profiles", args: { p_profile_ids: [idB, idA] } }]);
  assert.ok(globalThis.__orderRevalidated.includes("/experten"));
  globalThis.__orderClient = client({ admin: true, rpcError: { message: "private database details" } });
  const failed = await saveCompanyDirectoryOrder([idA, idB]);
  assert.match(failed.error, /nicht gespeichert/);
  assert.doesNotMatch(failed.error, /private database details/);
});
