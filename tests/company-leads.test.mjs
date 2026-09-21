import test from "node:test";
import assert from "node:assert/strict";
import {
  createLead,
  validateLead,
  loadLeads,
  updateLeadStatus,
} from "../src/lib/company-leads.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function form() {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    name: " Name ",
    email: " Person@Example.org ",
    phone: "",
    message: " Nachricht ",
    consent: "on",
    website: "",
  }))
    f.set(k, v);
  return f;
}
test("lead validation: required fields, consent, honeypot, email and each length limit", () => {
  assert.equal(validateLead(form()).error, undefined);
  for (const [key, value] of [
    ["name", ""],
    ["email", ""],
    ["message", ""],
    ["consent", ""],
    ["website", "spam"],
    ["email", "invalid"],
    ["name", "x".repeat(121)],
    ["email", "x".repeat(255)],
    ["phone", "x".repeat(51)],
    ["message", "x".repeat(5001)],
  ]) {
    const f = form();
    f.set(key, value);
    assert.ok(validateLead(f).error, key);
  }
  const f = form();
  f.set("message", "x".repeat(5000));
  assert.equal(validateLead(f).error, undefined);
});
test("public submission sends only allowed fields, rejects demos and treats errors/null as failure", async () => {
  const f = form();
  f.set("status", "done");
  f.set("profile_id", "foreign");
  let calls = 0;
  const client = {
    rpc: async (name, args) => {
      calls++;
      assert.equal(name, "create_company_lead");
      assert.equal(args.p_profile_id, id);
      assert.equal(args.p_name, "Name");
      assert.equal(args.p_email, "person@example.org");
      assert.equal(args.status, undefined);
      return { data: true, error: null };
    },
  };
  assert.ok((await createLead(client, id, f)).success);
  assert.ok((await createLead(client, "demo-profile", f)).error);
  assert.equal(calls, 1);
  for (const result of [
    { data: null, error: null },
    { data: false, error: null },
    { data: true, error: { message: "internal SQL secret" } },
    { error: { message: "duplicate_lead" } },
  ]) {
    const reply = await createLead({ rpc: async () => result }, id, f);
    assert.ok(reply.error);
    assert.equal(reply.success, undefined);
    assert.doesNotMatch(reply.error, /internal SQL/);
  }
  assert.ok(
    (
      await createLead(
        {
          rpc: async () => {
            throw Error("secret");
          },
        },
        id,
        f,
      )
    ).error,
  );
});
function client({ user = true, foreign = false, error = false } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      getUser: async () => ({
        data: { user: user ? { id: "verified-owner" } : null },
        error: null,
      }),
    },
    from(table) {
      const filters = [];
      calls.push({ table, filters });
      return {
        select() {
          return this;
        },
        eq(k, v) {
          filters.push([k, v]);
          return this;
        },
        order(k, v) {
          calls.push({ order: k, ...v });
          return this;
        },
        range: async () => ({ data: [], count: 0, error: error ? {} : null }),
        update(values) {
          calls.push({ update: values });
          return this;
        },
        maybeSingle: async () => ({
          data:
            table === "companies"
              ? { id: "own-company" }
              : table === "company_profiles"
                ? { id }
                : foreign
                  ? null
                  : { id },
          error: null,
        }),
      };
    },
  };
}
test("inbox requires verified user and queries own profile newest first; errors are not empty success", async () => {
  const no = client({ user: false });
  assert.ok((await loadLeads(no)).unauthenticated);
  assert.equal(no.calls.length, 0);
  const c = client();
  assert.deepEqual((await loadLeads(c)).leads, []);
  assert.ok(
    c.calls.some(
      (x) =>
        x.table === "companies" &&
        x.filters.some(
          ([k, v]) => k === "owner_user_id" && v === "verified-owner",
        ),
    ),
  );
  assert.ok(
    c.calls.some(
      (x) =>
        x.table === "company_leads" &&
        x.filters.some(([k, v]) => k === "profile_id" && v === id),
    ),
  );
  assert.ok(
    c.calls.some((x) => x.order === "created_at" && x.ascending === false),
  );
  assert.ok((await loadLeads(client({ error: true }))).error);
});
test("status mutation ignores supplied ownership and content; cannot update missing/foreign row", async () => {
  const f = new FormData();
  f.set("lead_id", id);
  f.set("status", "done");
  f.set("profile_id", "foreign");
  f.set("name", "attack");
  const c = client();
  assert.ok((await updateLeadStatus(c, f)).success);
  assert.deepEqual(c.calls.find((x) => x.update).update, { status: "done" });
  assert.ok(
    c.calls.some(
      (x) =>
        x.table === "company_leads" &&
        x.filters.some(([k, v]) => k === "profile_id" && v === id),
    ),
  );
  assert.ok((await updateLeadStatus(client({ foreign: true }), f)).error);
  for (const status of ["approved", "", "deleted"]) {
    f.set("status", status);
    assert.ok((await updateLeadStatus(client(), f)).error);
  }
  assert.ok(
    (await updateLeadStatus(client({ user: false }), f)).unauthenticated,
  );
});
