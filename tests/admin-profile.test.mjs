import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
import { profileFields } from "../src/lib/company-profile.ts";
const { updateAdminCompanyProfile } = await import("../src/lib/admin-profile.ts");

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    display_name: " Redaktionelle Firma ",
    business_areas: " Reiseberatung ",
    city: " Berlin ",
    ...overrides,
  })) data.set(key, value);
  return data;
}

function client({
  authenticated = true,
  admin = true,
  adminError = null,
  missingProfile = false,
  readError = null,
  updateError = null,
  updated = true,
} = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: "verified-admin", user_metadata: { role: "owner" } } : null },
        error: null,
      }),
    },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return {
        select(columns) {
          call.columns = columns;
          return this;
        },
        update(payload) {
          call.payload = payload;
          return this;
        },
        eq(key, value) {
          call.filters.push([key, value]);
          return this;
        },
        async maybeSingle() {
          if (table === "portal_admins") return {
            data: admin ? { user_id: "verified-admin" } : null,
            error: adminError,
          };
          if (call.payload) return {
            data: updated ? { id: profileId } : null,
            error: updateError,
          };
          return {
            data: missingProfile ? null : { id: profileId },
            error: readError,
          };
        },
      };
    },
  };
}

test("only verified portal admins can edit; owner and metadata grant no access", async () => {
  for (const options of [
    { authenticated: false },
    { admin: false },
    { adminError: { message: "private lookup error" } },
  ]) {
    const db = client(options);
    const result = await updateAdminCompanyProfile(db, profileId, form());
    assert.notEqual(result.access, "admin");
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
  const db = client();
  await updateAdminCompanyProfile(db, profileId, form());
  assert.deepEqual(db.calls[0].filters, [["user_id", "verified-admin"]]);
  assert.ok(db.calls.every((call) => call.table !== "companies"));
});

test("malformed profile ID and invalid fields never query or update profiles", async () => {
  for (const [id, data] of [
    ["not-an-id", form()],
    [profileId, form({ display_name: "" })],
    [profileId, form({ website: "javascript:bad" })],
  ]) {
    const db = client();
    assert.ok((await updateAdminCompanyProfile(db, id, data)).error);
    assert.equal(db.calls.length, 1);
  }
});

test("admin updates only validated normal fields on the verified profile row", async () => {
  const db = client();
  const result = await updateAdminCompanyProfile(db, profileId, form({
    profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    company_id: "foreign-company",
    owner_user_id: "foreign-owner",
    slug: "hijacked",
    status: "approved",
    submitted_at: "2000-01-01",
    approved_at: "2000-01-01",
    country: "Deutschland",
    contact_first_name: "", contact_last_name: "",
  }));
  assert.ok(result.success);
  assert.deepEqual(db.calls[1].filters, [["id", profileId]]);
  assert.deepEqual(db.calls[2].filters, [["id", profileId]]);
  assert.deepEqual(Object.keys(db.calls[2].payload).sort(), [...profileFields].sort());
  assert.equal(db.calls[2].payload.display_name, "Redaktionelle Firma");
  assert.equal(db.calls[2].payload.business_areas, "Reiseberatung");
  assert.equal(db.calls[2].payload.city, "Berlin");
  assert.equal(db.calls[2].payload.phone, null);
});
test("admin address save includes country only when the editor submits it", async () => {
  const withCountry = client();
  await updateAdminCompanyProfile(withCountry, profileId, form({ street: "Bahnhofstraße 4", postal_code: "10115", country: "Deutschland" }));
  assert.equal(withCountry.calls.find((call) => call.payload).payload.country, "Deutschland");
  const oldForm = client();
  await updateAdminCompanyProfile(oldForm, profileId, form());
  assert.equal("country" in oldForm.calls.find((call) => call.payload).payload, false);
});

test("missing profile, read error, failed update and stale update never report success", async () => {
  for (const options of [
    { missingProfile: true },
    { readError: { message: "private read error" } },
    { updateError: { message: "private write error" } },
    { updated: false },
  ]) {
    const db = client(options);
    const result = await updateAdminCompanyProfile(db, profileId, form());
    assert.ok(result.error);
    assert.equal(result.success, undefined);
    assert.doesNotMatch(result.error, /private/);
    if (options.missingProfile || options.readError)
      assert.ok(!db.calls.some((call) => call.payload));
  }
});


test('admin contact names share validation, optional clearing and whitelist while old forms preserve names',async()=>{
 const invalid=client();assert.ok((await updateAdminCompanyProfile(invalid,profileId,form({contact_first_name:'a'.repeat(121)}))).error);assert.equal(invalid.calls.some(c=>c.payload),false);
 for(const fields of [{}, {contact_first_name:' Anna ',contact_last_name:''}]){
  const db=client();assert.ok((await updateAdminCompanyProfile(db,profileId,form({...fields,contact_image_path:'forged'}))).success);
  const payload=db.calls.find(c=>c.payload).payload;
  assert.equal('contact_image_path' in payload,false);
  if ('contact_first_name' in fields){assert.equal(payload.contact_first_name,'Anna');assert.equal(payload.contact_last_name,null);}
  else assert.equal('contact_first_name' in payload,false);
 }
});
