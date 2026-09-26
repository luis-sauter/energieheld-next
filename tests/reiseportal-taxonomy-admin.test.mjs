import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith("/admin-review")) return {
      url: 'data:text/javascript,export async function checkAdmin(client){return client.access};export function isProfileId(value){return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)}',
      shortCircuit: true,
    };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});

const { updateAdminTravelTerm } = await import("../src/lib/admin-travel-taxonomy.ts");
const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function client(access = "admin", foundProfile = true, foundTerm = true) {
  const calls = [];
  return { access, calls, from(table) {
    calls.push(["from", table]);
    return {
      select() { return {
        eq() { return { maybeSingle: async () => ({
          data: table === "company_profiles"
            ? (foundProfile ? { id: profileId } : null)
            : (foundTerm ? { term_key: "theme:tauchurlaub" } : null),
          error: null,
        }) }; },
      }; },
      upsert(row) { calls.push(["upsert", row]); return Promise.resolve({ error: null }); },
      delete() { calls.push(["delete"]); return {
        eq() { return this; },
        then(resolve) { resolve({ error: null }); },
      }; },
    };
  } };
}

test("only an authenticated portal admin can change validated travel assignments", async () => {
  const denied = client("forbidden");
  assert.equal((await updateAdminTravelTerm(denied, profileId, "theme:tauchurlaub", true)).access, "forbidden");
  assert.deepEqual(denied.calls, []);

  const invalid = client();
  assert.match((await updateAdminTravelTerm(invalid, "bad-id", "theme:tauchurlaub", true)).error, /ungültig/);
  assert.match((await updateAdminTravelTerm(invalid, profileId, "theme:tauchurlaub;drop", true)).error, /ungültig/);
  assert.deepEqual(invalid.calls, []);

  const missing = client("admin", false);
  assert.match((await updateAdminTravelTerm(missing, profileId, "theme:tauchurlaub", true)).error, /nicht gefunden/);
  assert.ok(!missing.calls.some(([kind]) => kind === "upsert"));

  const allowed = client();
  assert.match((await updateAdminTravelTerm(allowed, profileId, "theme:tauchurlaub", true)).success, /gespeichert/);
  assert.deepEqual(allowed.calls.find(([kind]) => kind === "upsert")[1],
    { profile_id: profileId, term_key: "theme:tauchurlaub" });
  assert.match((await updateAdminTravelTerm(allowed, profileId, "theme:tauchurlaub", false)).success, /gespeichert/);
  assert.ok(allowed.calls.some(([kind]) => kind === "delete"));
});
