import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
test("public read migration grants exactly public columns and preserves approved-only RLS", async () => {
  const db = new PGlite();
  try {
    await db.exec(await read("./fixtures/company-schema.sql"));
    await db.exec(`alter table company_profiles add column slug text, add column tagline text, add column description text,
   add column phone text, add column public_email text, add column website text, add column postal_code text,
   add column city text, add column region text, add column country text, add column logo_url text,
   add column street text, add column created_at timestamptz, add column updated_at timestamptz;`);
    await db.exec(
      await read(
        "../supabase/migrations/20260916145904_add_company_categories_and_admin_assignment.sql",
      ),
    );
    await db.exec(
      await read(
        "../supabase/migrations/20260916195841_grant_public_company_profile_read.sql",
      ),
    );
    const columns = (
      await db.query(
        `select column_name from information_schema.column_privileges where grantee='anon' and table_name='company_profiles' and privilege_type='SELECT' order by column_name`,
      )
    ).rows.map((r) => r.column_name);
    assert.deepEqual(
      columns,
      [
        "id",
        "status",
        "slug",
        "display_name",
        "tagline",
        "description",
        "phone",
        "public_email",
        "website",
        "postal_code",
        "city",
        "region",
        "country",
        "logo_url",
        "business_areas",
      ].sort(),
    );
    const user = "11111111-1111-4111-8111-111111111111",
      profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.exec(`insert into portal_admins values ('${user}'); insert into companies values ('${user}','${user}','Firma');
   insert into company_profiles(id,company_id,display_name,status,slug) values ('${profile}','${user}','Freigegeben','pending','public');
   select set_config('request.jwt.claim.sub','${user}',false);
   select review_company_profile_with_categories('${profile}','approved',array['daemmung','fassade']);`);
    for (const [i, status] of ["draft", "pending", "rejected"].entries())
      await db.query(
        "insert into company_profiles(id,display_name,status,slug) values ($1,$2,$2,$2)",
        [`00000000-0000-4000-8000-00000000000${i}`, status],
      );
    // Even a stale owner/admin subject cannot activate authenticated-only policies under anon.
    await db.exec("set role anon");
    assert.deepEqual(
      (
        await db.query(
          "select display_name,slug,business_areas from company_profiles",
        )
      ).rows,
      [{ display_name: "Freigegeben", slug: "public", business_areas: null }],
    );
    assert.deepEqual(
      (
        await db.query(
          "select category_id from company_profile_categories order by category_id",
        )
      ).rows.map((r) => r.category_id),
      ["daemmung", "fassade"],
    );
    for (const field of [
      "company_id",
      "street",
      "submitted_at",
      "approved_at",
      "created_at",
      "updated_at",
    ])
      await assert.rejects(
        db.query(`select ${field} from company_profiles`),
        /permission denied/,
      );
    for (const table of ["companies", "portal_admins"])
      await assert.rejects(
        db.query(`select * from ${table}`),
        /permission denied/,
      );
  } finally {
    await db.close();
  }
});
