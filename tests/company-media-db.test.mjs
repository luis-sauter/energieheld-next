import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const path = (kind = "gallery", n = 0, id = profile) =>
  `profiles/${id}/${kind}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.png`;
let db;
before(async () => {
  db = new PGlite();
  await db.exec(await read("./fixtures/company-schema.sql"));
  await db.exec(`create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select on storage.objects to anon,authenticated;
 grant insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
 alter table company_profiles add column slug text, add column tagline text, add column description text,
 add column phone text, add column public_email text, add column website text, add column postal_code text,
 add column city text, add column region text, add column country text, add column logo_url text;`);
  for (const name of [
    "20260916145904_add_company_categories_and_admin_assignment.sql",
    "20260916195841_grant_public_company_profile_read.sql",
    "20260916202508_company_profile_media.sql",
  ])
    await db.exec(await read("../supabase/migrations/" + name));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Own'),($2,$2,'Other')", [
    owner,
    other,
  ]);
  await db.query(
    "insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Own','draft'),($3,$4,'Other','draft')",
    [profile, owner, foreign, other],
  );
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
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
async function object(p) {
  await db.query(
    "insert into storage.objects(bucket_id,name) values ('company-media',$1)",
    [p],
  );
}
async function gallery(n = 0) {
  await object(path("gallery", n));
  return (
    await db.query(
      "insert into company_profile_images(profile_id,storage_path,sort_order) values ($1,$2,$3) returning id",
      [profile, path("gallery", n), n],
    )
  ).rows[0].id;
}
async function approve() {
  await actor(owner);
  await db.query("update company_profiles set status='pending' where id=$1", [
    profile,
  ]);
  await actor(admin);
  await db.query(
    "select review_company_profile_with_categories($1,'approved',array['heizung'])",
    [profile],
  );
}

test("media bucket is private with exactly supported types and 5MB limit", async () => {
  const row = (
    await db.query("select * from storage.buckets where id='company-media'")
  ).rows[0];
  assert.equal(row.public, false);
  assert.equal(Number(row.file_size_limit), 5242880);
  assert.deepEqual(row.allowed_mime_types, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
});
test("owner writes own gallery only; forged foreign paths and image reparenting are blocked", async () => {
  await actor(owner);
  const id = await gallery();
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
    [foreign, path("gallery", 1, foreign)],
  );
  await blocked("update company_profile_images set profile_id=$1 where id=$2", [
    foreign,
    id,
  ]);
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
    [profile, path("gallery", 1, foreign)],
  );
  await actor(other);
  assert.equal(
    (
      await db.query(
        "delete from company_profile_images where id=$1 returning id",
        [id],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "update company_profile_images set sort_order=4 where id=$1 returning id",
        [id],
      )
    ).rows.length,
    0,
  );
  await blocked("select reorder_company_images($1,$2::uuid[])", [
    profile,
    [id],
  ]);
});
test("eight-image limit holds for direct and multirow inserts", async () => {
  await actor(owner);
  for (let i = 0; i < 8; i++) await gallery(i);
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
    [profile, path("gallery", 8)],
  );
  assert.equal(
    Number(
      (await db.query("select count(*) from company_profile_images")).rows[0]
        .count,
    ),
    8,
  );
  await db.query("delete from company_profile_images where profile_id=$1", [
    profile,
  ]);
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) select $1, 'profiles/'||$1||'/gallery/00000000-0000-4000-8000-'||lpad(i::text,12,'0')||'.png' from generate_series(1,9) i",
    [profile],
  );
  assert.equal(
    Number(
      (await db.query("select count(*) from company_profile_images")).rows[0]
        .count,
    ),
    0,
  );
});
test("logo replacement/removal and gallery changes atomically revoke approval and preserve categories", async () => {
  await actor(owner);
  await object(path("logo"));
  await db.query("update company_profiles set logo_path=$1 where id=$2", [
    path("logo"),
    profile,
  ]);
  await gallery();
  const second = await gallery(1);
  for (const mutate of [
    async () => {
      await object(path("logo", 1));
      await db.query("update company_profiles set logo_path=$1 where id=$2", [
        path("logo", 1),
        profile,
      ]);
    },
    () =>
      db.query("update company_profiles set logo_path=null where id=$1", [
        profile,
      ]),
    () => gallery(2),
    () => db.query("delete from company_profile_images where id=$1", [second]),
  ]) {
    await approve();
    await actor(owner);
    await mutate();
    assert.deepEqual(
      (
        await db.query(
          "select status,approved_at from company_profiles where id=$1",
          [profile],
        )
      ).rows[0],
      { status: "draft", approved_at: null },
    );
    assert.deepEqual(
      (
        await db.query(
          "select category_id from company_profile_categories where profile_id=$1",
          [profile],
        )
      ).rows,
      [{ category_id: "heizung" }],
    );
  }
  const ids = (
    await db.query("select id from company_profile_images order by sort_order")
  ).rows
    .map((r) => r.id)
    .reverse();
  await approve();
  await actor(owner);
  await db.query("select reorder_company_images($1,$2::uuid[])", [
    profile,
    ids,
  ]);
  assert.equal(
    (
      await db.query("select status from company_profiles where id=$1", [
        profile,
      ])
    ).rows[0].status,
    "draft",
  );
  assert.deepEqual(
    (
      await db.query(
        "select id from company_profile_images order by sort_order",
      )
    ).rows.map((r) => r.id),
    ids,
  );
});
test("pending stays pending and rejected becomes draft for media edits", async () => {
  await actor(owner);
  await gallery();
  await db.query("update company_profiles set status='pending' where id=$1", [
    profile,
  ]);
  await db.query(
    "update company_profile_images set sort_order=1 where profile_id=$1",
    [profile],
  );
  assert.equal(
    (
      await db.query("select status from company_profiles where id=$1", [
        profile,
      ])
    ).rows[0].status,
    "pending",
  );
  await actor(admin);
  await db.query(
    "select review_company_profile_with_categories($1,'rejected',array[]::text[])",
    [profile],
  );
  await actor(owner);
  await db.query(
    "update company_profile_images set sort_order=2 where profile_id=$1",
    [profile],
  );
  assert.equal(
    (
      await db.query("select status from company_profiles where id=$1", [
        profile,
      ])
    ).rows[0].status,
    "draft",
  );
});
for (const status of ["draft", "pending", "rejected", "approved"])
  test(`anon storage and gallery visibility for ${status}`, async () => {
    await actor(owner);
    await object(path("logo"));
    await object(path("logo", 9));
    await db.query("update company_profiles set logo_path=$1 where id=$2", [
      path("logo"),
      profile,
    ]);
    await gallery();
    await approve();
    await db.exec("reset role");
    await db.query("update company_profiles set status=$1 where id=$2", [
      status,
      profile,
    ]);
    await actor("", "anon");
    assert.equal(
      (await db.query("select * from company_profile_images")).rows.length,
      status === "approved" ? 1 : 0,
    );
    const objects = (
      await db.query("select name from storage.objects order by name")
    ).rows.map((r) => r.name);
    assert.deepEqual(
      objects,
      status === "approved" ? [path("gallery"), path("logo")].sort() : [],
    );
  });
test("admin can preview all media but cannot manage another company gallery", async () => {
  await actor(owner);
  const id = await gallery();
  await object(path("logo"));
  await actor(admin);
  assert.equal(
    (await db.query("select * from company_profile_images")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    2,
  );
  assert.equal(
    (
      await db.query(
        "delete from company_profile_images where id=$1 returning id",
        [id],
      )
    ).rows.length,
    0,
  );
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
    [profile, path("gallery", 4)],
  );
});
test("storage forbids foreign writes, overwrites, SVG and deleting referenced files; orphan remains private", async () => {
  await actor(owner);
  await object(path("logo"));
  await db.query("update company_profiles set logo_path=$1 where id=$2", [
    path("logo"),
    profile,
  ]);
  await blocked(
    "insert into storage.objects(bucket_id,name) values ('company-media',$1)",
    [path("logo", 1, foreign)],
  );
  await blocked(
    "insert into storage.objects(bucket_id,name) values ('company-media',$1)",
    [path("logo", 1).replace(".png", ".svg")],
  );
  assert.equal(
    (
      await db.query(
        "update storage.objects set name=$1 where name=$2 returning id",
        [path("logo", 2), path("logo")],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path("logo"),
      ])
    ).rows.length,
    0,
  );
  await db.query("update company_profiles set logo_path=null where id=$1", [
    profile,
  ]);
  await approve();
  await actor("", "anon");
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await actor(owner);
  assert.equal(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path("logo"),
      ])
    ).rows.length,
    1,
  );
  await blocked("update company_profiles set logo_path=$1 where id=$2", [
    "https://example.org/signed?token=secret",
    profile,
  ]);
});
