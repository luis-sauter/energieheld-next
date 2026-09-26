import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const outsider = "22222222-2222-4222-8222-222222222222";
const statuses = ["draft", "pending", "approved", "rejected"];
let db;

async function actor(id = "", role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function blocked(sql, params = []) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(sql, params));
  await db.exec("rollback to savepoint denied; release savepoint denied");
}

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec(`alter table companies alter column id set default gen_random_uuid();
    alter table company_profiles alter column id set default gen_random_uuid();
    alter table company_profiles add column street text;
    alter table company_profiles add constraint company_profiles_slug_key unique(slug);
    alter table companies add constraint companies_owner_user_id_key unique(owner_user_id);
    create policy profiles_admin_update on company_profiles for update to authenticated
      using (exists(select 1 from portal_admins where user_id=auth.uid()))
      with check (exists(select 1 from portal_admins where user_id=auth.uid()));`);
  for (const name of [
    "20260924155258_admin_company_media_editor.sql",
    "20260924171344_profile_content_blocks.sql",
    "20260924202803_profile_image_grid_blocks.sql",
    "20260924210916_profile_image_grid_resizing.sql",
    "20260924214027_universal_content_block_layout.sql",
    "20260924220748_image_crop_focus_zoom.sql",
    "20260925083617_profile_block_image_captions.sql",
    "20260926082908_unify_reiseportal_admin_editing.sql",
    "20260926083815_grant_approved_profile_street_read.sql",
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies(id,owner_user_id,legal_name) values ($1,$1,'Owned')", [owner]);
  for (const [index, status] of statuses.entries())
    await db.query("insert into company_profiles(id,company_id,display_name,slug,status) values ($1,$2,$3,$4,$5)", [
      `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`, owner, `Status ${status}`, `status-${status}`, status === "approved" ? "pending" : status,
    ]);
  const approved = await db.query("select id from company_profiles where slug='status-approved'");
  await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [approved.rows[0].id]);
  await db.query("update company_profiles set status='approved' where id=$1", [approved.rows[0].id]);
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));

test("five sourced accommodations are persisted once without owner or fabricated categories", async () => {
  const slugs = ["bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber", "villner-hof"];
  const { rows } = await db.query(`select p.slug,p.status,p.country,p.street,p.website,c.owner_user_id,
    (select count(*)::int from company_profile_categories x where x.profile_id=p.id) categories
    from company_profiles p join companies c on c.id=p.company_id where p.slug = any($1::text[]) order by p.slug`, [slugs]);
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.status === "approved" && row.owner_user_id === null && row.categories === 0));
  assert.equal(rows.find((row) => row.slug === "villner-hof").website, null);
  assert.equal(rows.find((row) => row.slug === "hoeflehner").country, "Österreich");
  await db.exec(await readFile(new URL("../supabase/migrations/20260926082908_unify_reiseportal_admin_editing.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select count(*)::int n from company_profiles where slug = any($1::text[])", [slugs])).rows[0].n, 5);
  assert.equal((await db.query("select count(*)::int n from companies where owner_user_id is null")).rows[0].n, 5);
});

test("anonymous visitors can read approved addresses but no unpublished profile rows", async () => {
  await actor("", "anon");
  const { rows } = await db.query("select slug,street from company_profiles where slug in ('bayerischer-wald','hoeflehner','pension-sonnenhof','schafhuber','villner-hof','status-rejected') order by slug");
  assert.equal(rows.length, 5);
  assert.equal(rows.find((row) => row.slug === "villner-hof").street, "Villnerstraße 30");
  assert.ok(rows.every((row) => row.slug !== "status-rejected"));
});

test("portal admins edit blocks and images at every status, while public SELECT stays approved-only", async () => {
  const ids = (await db.query("select id,status from company_profiles where slug like 'status-%' order by status")).rows;
  const created = [];
  await actor(admin);
  for (const row of ids) {
    const block = (await db.query("select insert_profile_content_block($1,'image_grid','',null) id", [row.id])).rows[0].id;
    const path = `profiles/${row.id}/blocks/${block}/55555555-5555-4555-8555-555555555555.jpg`;
    const image = (await db.query("insert into profile_content_block_images(block_id,storage_path,alt_text) values ($1,$2,'Alt') returning id", [block, path])).rows[0].id;
    await db.query("update profile_content_block_images set alt_text='Neu' where id=$1", [image]);
    await db.query("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [path]);
    created.push({ ...row, block, image, path });
  }
  assert.equal((await db.query("select count(*)::int n from profile_content_blocks where id = any($1::uuid[])", [created.map((row) => row.block)])).rows[0].n, 4);
  await actor("", "anon");
  assert.deepEqual((await db.query("select id from profile_content_blocks where id = any($1::uuid[])", [created.map((row) => row.block)])).rows.map((row) => row.id), [created.find((row) => row.status === "approved").block]);
  assert.deepEqual((await db.query("select id from profile_content_block_images where id = any($1::uuid[])", [created.map((row) => row.image)])).rows.map((row) => row.id), [created.find((row) => row.status === "approved").image]);
  assert.deepEqual((await db.query("select name from storage.objects where name = any($1::text[])", [created.map((row) => row.path)])).rows.map((row) => row.name), [created.find((row) => row.status === "approved").path]);
  await actor(outsider);
  await blocked("select insert_profile_content_block($1,'text','Verboten',null)", [created[0].id]);
  assert.equal((await db.query("update profile_content_block_images set alt_text='Angriff' where id=$1 returning id", [created[0].image])).rows.length, 0);
  await actor(owner);
  await blocked("select insert_profile_content_block($1,'text','Verboten',null)", [created[0].id]);
  await actor(admin);
  await db.query("select reorder_profile_block_images($1,$2,$3::uuid[])", [created[0].id, created[0].block, [created[0].image]]);
  assert.equal((await db.query("select alt_text from profile_content_block_images where id=$1", [created[0].image])).rows[0].alt_text, "Neu");
});
