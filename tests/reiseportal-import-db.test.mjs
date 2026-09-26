import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20260926145100_import_targeted_reiseportal_providers.sql", import.meta.url), "utf8");

test("targeted import is idempotent, keeps existing slugs, and has no fake owner", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.companies (
        id uuid primary key default gen_random_uuid(),
        owner_user_id uuid, legal_name text not null, contact_email text
      );
      create table public.company_profiles (
        id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
        slug text not null unique, display_name text not null, tagline text, description text,
        business_areas text, street text, postal_code text, city text, region text,
        country text not null default 'Deutschland', phone text, public_email text, website text,
        status text not null default 'draft', approved_at timestamptz
      );
      insert into public.companies (legal_name) values ('Existing Wirthshof');
      insert into public.company_profiles (company_id, slug, display_name, status)
        select id, 'wirthshof', 'Existing Wirthshof', 'approved' from public.companies;
    `);
    await db.exec(migration);
    await db.exec(migration);
    const { rows } = await db.query(`
      select p.slug, p.display_name, p.status, p.description, p.business_areas,
        p.region, p.public_email, c.owner_user_id
      from public.company_profiles p join public.companies c on c.id = p.company_id
      order by p.slug
    `);
    assert.equal(rows.length, 5);
    assert.equal(rows.find((row) => row.slug === "wirthshof").display_name, "Existing Wirthshof");
    for (const row of rows.filter((row) => row.slug !== "wirthshof")) {
      assert.equal(row.status, "approved");
      assert.equal(row.region, null);
      assert.equal(row.owner_user_id, null);
      assert.ok(row.description && row.business_areas && row.public_email);
    }
    assert.equal((await db.query("select count(*)::int as total from public.companies")).rows[0].total, 5);
  } finally {
    await db.close();
  }
});
