import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCredentials,
  authErrorMessage,
  profileStatus,
} from "../src/lib/auth.ts";
import { loadCompanyDashboard } from "../src/lib/company-dashboard.ts";

function registration(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: " kontakt@example.com ",
    password: " passwort ",
    password_confirmation: " passwort ",
    full_name: " Erika Muster ",
    company_name: " Muster GmbH ",
    ...overrides,
  }))
    data.set(key, value);
  return data;
}

test("registration requires every field and rejects whitespace-only names", () => {
  for (const key of [
    "email",
    "password",
    "password_confirmation",
    "full_name",
    "company_name",
  ]) {
    assert.ok(validateCredentials(registration({ [key]: "" }), true).error);
  }
  assert.ok(
    validateCredentials(registration({ company_name: "   " }), true).error,
  );
});

test("registration validates email, minimum password length and matching passwords", () => {
  assert.match(
    validateCredentials(registration({ email: "invalid" }), true).error,
    /E-Mail/,
  );
  assert.match(
    validateCredentials(registration({ password: "1234567" }), true).error,
    /8 Zeichen/,
  );
  assert.match(
    validateCredentials(
      registration({ password_confirmation: "different" }),
      true,
    ).error,
    /überein/,
  );
});

test("registration trims names and email but preserves password whitespace", () => {
  const result = validateCredentials(registration(), true);
  assert.equal(result.error, undefined);
  assert.equal(result.full_name, "Erika Muster");
  assert.equal(result.company_name, "Muster GmbH");
  assert.equal(result.email, "kontakt@example.com");
  assert.equal(result.password, " passwort ");
});

test("login does not impose new signup password rules on existing accounts", () => {
  assert.equal(
    validateCredentials(registration({ password: "legacy" })).error,
    undefined,
  );
});

test("auth errors and profile statuses have safe German messages", () => {
  assert.match(authErrorMessage("invalid_credentials"), /falsch/);
  assert.match(authErrorMessage("email_not_confirmed"), /bestätigen/);
  assert.equal(profileStatus("draft"), "Entwurf");
  assert.equal(profileStatus("pending"), "Zur Prüfung eingereicht");
  assert.equal(profileStatus("approved"), "Freigegeben");
  assert.equal(profileStatus("rejected"), "Änderungen erforderlich");
  assert.equal(profileStatus("unexpected"), "Unbekannter Status");
});

function fakeClient({
  user = { id: "verified-owner", email: "owner@example.com" },
  authError = null,
  company = { id: "own-company", legal_name: "Own Company" },
  companyError = null,
  profile = { status: "draft", display_name: "Own Company" },
  profileError = null,
} = {}) {
  const filters = [];
  return {
    filters,
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from(table) {
      return {
        select() {
          return this;
        },
        eq(column, value) {
          filters.push([table, column, value]);
          return this;
        },
        async maybeSingle() {
          return table === "companies"
            ? { data: company, error: companyError }
            : { data: profile, error: profileError };
        },
      };
    },
  };
}

test("unauthenticated or invalid sessions never query company data", async () => {
  for (const options of [
    { user: null },
    { authError: { message: "invalid token" } },
  ]) {
    const client = fakeClient(options);
    assert.equal((await loadCompanyDashboard(client)).authenticated, false);
    assert.deepEqual(client.filters, []);
  }
});

test("dashboard restricts both queries to the server-verified owner and their company", async () => {
  const client = fakeClient();
  const result = await loadCompanyDashboard(client);
  assert.equal(result.profile.status, "draft");
  assert.deepEqual(client.filters, [
    ["companies", "owner_user_id", "verified-owner"],
    ["company_profiles", "company_id", "own-company"],
  ]);
});

test("missing or inaccessible company stops profile queries", async () => {
  for (const options of [
    { company: null },
    { companyError: { message: "private DB detail" } },
  ]) {
    const client = fakeClient(options);
    const result = await loadCompanyDashboard(client);
    assert.ok(result.error);
    assert.equal(result.error.includes("private DB detail"), false);
    assert.equal(client.filters.length, 1);
    assert.equal(result.profile, undefined);
  }
});

test("profile errors do not fabricate a draft status", async () => {
  const result = await loadCompanyDashboard(
    fakeClient({ profile: null, profileError: { message: "DB error" } }),
  );
  assert.ok(result.error);
  assert.equal(result.profile, null);
});
