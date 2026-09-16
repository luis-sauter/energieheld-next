import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProfile,
  updateOwnCompanyProfile,
  profileFields,
} from "../src/lib/company-profile.ts";

function form(overrides = {}) {
  const data = new FormData();
  Object.entries({
    display_name: " Meine Firma ",
    business_areas: "WDVS, Fassadensanierung",
    intent: "save",
    ...overrides,
  }).forEach(([name, value]) => data.set(name, value));
  return data;
}

function client({
  status = "draft",
  authenticated = true,
  missingCompany = false,
  missingProfile = false,
  updateError = null,
  updated = true,
} = {}) {
  const queries = [];
  return {
    queries,
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: "verified-owner" } : null },
        error: null,
      }),
    },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select() {
          return this;
        },
        update(payload) {
          query.payload = payload;
          return this;
        },
        eq(key, value) {
          query.filters.push([key, value]);
          return this;
        },
        async maybeSingle() {
          if (query.payload)
            return {
              error: updateError,
              data: updated ? { company_id: "own-company" } : null,
            };
          if (table === "companies")
            return {
              error: null,
              data: missingCompany ? null : { id: "own-company" },
            };
          return { error: null, data: missingProfile ? null : { status } };
        },
      };
    },
  };
}

test("profile name is required; optional fields may be empty", () => {
  assert.match(
    validateProfile(form({ display_name: "  " })).error,
    /Profilnamen/,
  );
  assert.equal(validateProfile(form()).error, undefined);
  assert.equal(validateProfile(form()).values.display_name, "Meine Firma");
});

test("company can save business areas as text without assigning categories", async () => {
  const db = client({ status: "approved" });
  const result = await updateOwnCompanyProfile(
    db,
    form({
      business_areas: "  Dämmung und Fassade  ",
      category_ids: "dach",
      company_profile_categories: "solar",
    }),
  );
  assert.ok(result.success);
  const write = db.queries.find((q) => q.payload);
  assert.equal(write.payload.business_areas, "Dämmung und Fassade");
  assert.equal(write.payload.status, "draft");
  assert.equal("category_ids" in write.payload, false);
  assert.equal("company_profile_categories" in write.payload, false);
  assert.equal(
    db.queries.some((q) => q.table === "company_profile_categories"),
    false,
  );
});

test("submission requires non-whitespace business areas; draft saves may be empty", async () => {
  for (const business_areas of ["", "  \n\t "]) {
    const db = client();
    assert.match(
      (
        await updateOwnCompanyProfile(
          db,
          form({ business_areas, intent: "submit" }),
        )
      ).error,
      /Tätigkeitsbereiche/,
    );
    assert.equal(db.queries.length, 0);
    assert.ok(
      (await updateOwnCompanyProfile(client(), form({ business_areas })))
        .success,
    );
  }
});

test("validates optional email, HTTP(S) website and simple postal code", () => {
  for (const input of [
    { public_email: "invalid" },
    { website: "javascript:alert(1)" },
    { website: "ftp://example.com" },
    { website: "example.com" },
    { website: "https://user:pass@example.com" },
    { postal_code: "AB123" },
    { postal_code: "1" },
  ]) {
    assert.ok(validateProfile(form(input)).error, JSON.stringify(input));
  }
  assert.equal(
    validateProfile(
      form({
        public_email: "info@example.com",
        website: "https://example.com/path",
        postal_code: "80331",
      }),
    ).error,
    undefined,
  );
  assert.equal(
    validateProfile(
      form({ website: "http://example.com", postal_code: "1010" }),
    ).error,
    undefined,
  );
});

test("unauthenticated user cannot query or update profiles", async () => {
  const db = client({ authenticated: false });
  assert.equal(
    (await updateOwnCompanyProfile(db, form())).unauthenticated,
    true,
  );
  assert.deepEqual(db.queries, []);
});

test("invalid input never starts a database write", async () => {
  const db = client();
  assert.ok(
    (await updateOwnCompanyProfile(db, form({ display_name: "" }))).error,
  );
  assert.deepEqual(db.queries, []);
});

test("own profile fields are saved and empty optional fields cleared", async () => {
  const db = client();
  assert.ok(
    (await updateOwnCompanyProfile(db, form({ city: " München " }))).success,
  );
  assert.deepEqual(db.queries[0].filters, [
    ["owner_user_id", "verified-owner"],
  ]);
  assert.deepEqual(db.queries[1].filters, [["company_id", "own-company"]]);
  const write = db.queries[2];
  assert.deepEqual(write.filters, [
    ["company_id", "own-company"],
    ["status", "draft"],
  ]);
  assert.equal(write.payload.display_name, "Meine Firma");
  assert.equal(write.payload.city, "München");
  assert.equal(write.payload.tagline, null);
  assert.deepEqual(
    Object.keys(write.payload).sort(),
    [...profileFields, "status", "submitted_at"].sort(),
  );
});

test("forged company IDs, slug, approved status and timestamps are ignored", async () => {
  const db = client();
  await updateOwnCompanyProfile(
    db,
    form({
      company_id: "foreign-company",
      id: "foreign-profile",
      owner_user_id: "foreign-user",
      slug: "hijacked",
      status: "approved",
      approved_at: "2000-01-01",
      submitted_at: "2000-01-01",
    }),
  );
  const write = db.queries[2];
  assert.equal(write.filters[0][1], "own-company");
  for (const key of [
    "id",
    "company_id",
    "owner_user_id",
    "slug",
    "approved_at",
  ])
    assert.equal(key in write.payload, false);
  assert.equal(write.payload.status, "draft");
  assert.equal(write.payload.submitted_at, null);
});

test("normal save preserves draft and pending; reviewed changes return to draft", async () => {
  for (const status of ["draft", "pending", "approved", "rejected"]) {
    const db = client({ status });
    await updateOwnCompanyProfile(db, form());
    assert.equal(
      db.queries[2].payload.status,
      status === "pending" ? "pending" : "draft",
    );
    if (status === "pending")
      assert.equal("submitted_at" in db.queries[2].payload, false);
  }
});

test("submission atomically saves fields, sets pending and a server timestamp", async () => {
  const db = client();
  const before = Date.now();
  const result = await updateOwnCompanyProfile(
    db,
    form({ intent: "submit", status: "approved", submitted_at: "2000-01-01" }),
  );
  assert.equal(result.success, "Ihr Profil wurde zur Prüfung eingereicht.");
  const writes = db.queries.filter((q) => q.payload);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.status, "pending");
  assert.equal(writes[0].payload.display_name, "Meine Firma");
  assert.ok(Date.parse(writes[0].payload.submitted_at) >= before);
  assert.ok(Date.parse(writes[0].payload.submitted_at) <= Date.now());
});

test("missing ownership or profile prevents updates", async () => {
  for (const options of [{ missingCompany: true }, { missingProfile: true }]) {
    const db = client(options);
    assert.ok((await updateOwnCompanyProfile(db, form())).error);
    assert.equal(
      db.queries.some((q) => q.payload),
      false,
    );
  }
});

test("failed or stale updates never report success", async () => {
  for (const options of [
    { updateError: { message: "private database detail" } },
    { updated: false },
  ]) {
    const result = await updateOwnCompanyProfile(client(options), form());
    assert.ok(result.error);
    assert.equal(result.success, undefined);
    assert.equal(result.error.includes("private database detail"), false);
  }
});

test("unknown action or unexpected stored status fails closed", async () => {
  const db = client({ status: "unknown" });
  assert.ok((await updateOwnCompanyProfile(db, form())).error);
  assert.equal(
    db.queries.some((q) => q.payload),
    false,
  );
  assert.ok(
    (await updateOwnCompanyProfile(client(), form({ intent: "approve" })))
      .error,
  );
});
