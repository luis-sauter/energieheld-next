import test from "node:test";
import assert from "node:assert/strict";
import {
  requestOwnVerification,
  readQualityRequest,
} from "../src/lib/company-quality-request.ts";

function client({
  user = { id: "owner" },
  error = null,
  company = { id: "own-company" },
  profile = { id: "own-profile" },
  rpcError = null,
} = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user }, error }) },
    from(table) {
      const filters = [];
      calls.push({ table, filters });
      return {
        select() {
          return this;
        },
        eq(key, value) {
          filters.push([key, value]);
          return this;
        },
        maybeSingle: async () => ({
          data: table === "companies" ? company : profile,
          error: null,
        }),
      };
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error: rpcError };
    },
  };
}
test("request action derives own profile from verified user and ignores submitted IDs/status", async () => {
  const db = client();
  const forged = new FormData();
  forged.set("profile_id", "foreign");
  forged.set("status", "approved");
  assert.ok((await requestOwnVerification(db, forged)).success);
  assert.deepEqual(db.calls, [
    { table: "companies", filters: [["owner_user_id", "owner"]] },
    { table: "company_profiles", filters: [["company_id", "own-company"]] },
    {
      name: "request_company_verification",
      args: { p_profile_id: "own-profile" },
    },
  ]);
});
test("request action fails closed for unauthenticated or missing ownership and hides RPC errors", async () => {
  for (const options of [
    { user: null },
    { error: { message: "invalid" } },
    { company: null },
    { profile: null },
  ]) {
    const db = client(options);
    const result = await requestOwnVerification(db);
    assert.ok(result.unauthenticated || result.error);
    assert.ok(!db.calls.some((c) => c.name));
  }
  const result = await requestOwnVerification(
    client({ rpcError: { message: "private detail" } }),
  );
  assert.ok(result.error);
  assert.doesNotMatch(result.error, /private detail/);
});
test("request relation parser accepts private states, never a verified seal", () => {
  const request = {
    status: "pending",
    requested_at: "2026-09-17T12:00:00Z",
    decided_at: null,
  };
  assert.deepEqual(readQualityRequest([request]), request);
  assert.equal(
    readQualityRequest({ ...request, status: "verified" }),
    undefined,
  );
  assert.equal(readQualityRequest(null), undefined);
});
