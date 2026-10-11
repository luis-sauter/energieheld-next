import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await readFile(new URL('../supabase/migrations/20261011205940_public_company_import_markers.sql',import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('public import projection exposes only requested approved/listed IDs and dates, never private notes or writes',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
   CREATE TABLE company_profiles(id uuid PRIMARY KEY,status text);
   CREATE TABLE company_profile_public_visibility(profile_id uuid PRIMARY KEY,is_listed boolean);
   CREATE TABLE company_profile_imports(profile_id uuid PRIMARY KEY,imported_at timestamptz,source_url text,review_note text);
   ALTER TABLE company_profile_imports ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON company_profile_imports FROM PUBLIC,anon,authenticated;
   INSERT INTO company_profiles VALUES ('${id(1)}','approved'),('${id(2)}','draft'),('${id(3)}','pending'),('${id(4)}','approved'),('${id(5)}','approved');
   INSERT INTO company_profile_public_visibility VALUES ('${id(4)}',false);
   INSERT INTO company_profile_imports SELECT id,'2026-10-11T00:00:00Z','https://private.example','Confidential review' FROM company_profiles WHERE id<>'${id(5)}';`);
  await db.exec(migration);
  for(const role of ['anon','authenticated']) {
   await db.exec('SET ROLE '+role);
   const rows=(await db.query('SELECT * FROM public_company_import_markers($1::uuid[])',[[1,2,3,4,5].map(id)])).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].profile_id,id(1));assert.deepEqual(Object.keys(rows[0]),['profile_id','imported_at']);
   await assert.rejects(db.query('SELECT * FROM company_profile_imports'));
   await assert.rejects(db.query('UPDATE company_profile_imports SET review_note=$1',['changed']));
   assert.equal((await db.query('SELECT * FROM public_company_import_markers($1::uuid[])',[[id(2),id(3),id(4)]])).rows.length,0);
   for(const ids of [[],null,Array(501).fill(id(1))])assert.equal((await db.query('SELECT * FROM public_company_import_markers($1::uuid[])',[ids])).rows.length,0);
   await db.exec('RESET ROLE');
  }
  // Publication retains provenance/date; unlisting immediately suppresses it.
  await db.exec(`UPDATE company_profiles SET status='approved' WHERE id='${id(2)}'; SET ROLE anon;`);
  assert.equal((await db.query('SELECT * FROM public_company_import_markers($1::uuid[])',[[id(2)]])).rows.length,1);
  await db.exec(`RESET ROLE; INSERT INTO company_profile_public_visibility VALUES ('${id(2)}',false); SET ROLE anon;`);
  assert.equal((await db.query('SELECT * FROM public_company_import_markers($1::uuid[])',[[id(2)]])).rows.length,0);
  await db.exec('RESET ROLE');
  const fn=(await db.query("SELECT prosecdef,proconfig,provolatile FROM pg_proc WHERE proname='public_company_import_markers'")).rows[0];
  assert.equal(fn.prosecdef,true);assert.equal(fn.provolatile,'s');assert.ok(fn.proconfig.some(v=>v.startsWith('search_path=')));
  assert.equal((await db.query('SELECT count(*)::int n FROM company_profile_imports')).rows[0].n,4);
 }finally{await db.close();}
});

