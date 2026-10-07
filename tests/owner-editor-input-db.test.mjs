import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', admin='33333333-3333-4333-8333-333333333333';
const own='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fields=['display_name','business_areas','tagline','description','phone','public_email','website','street','postal_code','city','region','country','contact_first_name','contact_last_name'];
async function setup() {
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
 CREATE TABLE portal_admins(user_id uuid PRIMARY KEY);
 CREATE TABLE companies(id uuid PRIMARY KEY,owner_user_id uuid);
 CREATE TABLE company_profiles(id uuid PRIMARY KEY,company_id uuid REFERENCES companies(id),slug text,status text,${fields.map(f=>f+' text').join(',')});
 ALTER TABLE companies ENABLE ROW LEVEL SECURITY; ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE portal_admins ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON portal_admins,companies TO authenticated; GRANT SELECT ON company_profiles TO anon,authenticated;
 GRANT UPDATE (${fields.join(',')}) ON company_profiles TO authenticated;
 CREATE POLICY admin_self ON portal_admins FOR SELECT TO authenticated USING(user_id=auth.uid());
 CREATE POLICY company_read ON companies FOR SELECT TO authenticated USING(owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid()));
 CREATE POLICY public_profile ON company_profiles FOR SELECT TO anon,authenticated USING(status='approved');
 CREATE POLICY own_profile ON company_profiles FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM companies WHERE id=company_id AND owner_user_id=auth.uid()));
 CREATE POLICY admin_profile ON company_profiles FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid()));
 CREATE POLICY update_profile ON company_profiles FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM companies WHERE id=company_id AND owner_user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM companies WHERE id=company_id AND owner_user_id=auth.uid()));
 INSERT INTO portal_admins VALUES ('${admin}');
 INSERT INTO companies VALUES ('${own}','${owner}'),('${foreign}','${other}');
 INSERT INTO company_profiles(id,company_id,slug,status,display_name) VALUES ('${own}','${own}','owner','draft','Before'),('${foreign}','${foreign}','foreign','approved','Foreign');`);
 for(const file of ['20260926160000_reiseportal_travel_taxonomy.sql','20261007171635_owner_editorial_notes.sql','20261007171657_owner_travel_profile_save.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO travel_terms VALUES ('feature:pool','feature','pool','Pool'); INSERT INTO company_profile_travel_terms VALUES ('${own}','audience:gruppe'),('${own}','feature:pool');`);
 return db;
}
async function as(db,role,user,run) {
 await db.exec('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user??'']); await db.exec('SET LOCAL ROLE '+role);
 try { const r=await run();await db.exec('COMMIT');return r; }catch(e){await db.exec('ROLLBACK');throw e;}
}
const save=(db,terms=['accommodation:hotel','audience:familie','audience:mit-hund','theme:radwandern','theme:wellnessangebote'],data={display_name:'After',business_areas:'Supplement'},status='draft')=>db.query('SELECT save_own_travel_profile($1::jsonb,$2::text[],$3)',[JSON.stringify(data),terms,status]);

test('private notes RLS: anon denied; own upsert/length/empty; foreign denied; admin read only; timestamps protected',async()=>{
 const db=await setup();try {
  await as(db,'authenticated',owner,()=>db.query(`INSERT INTO company_profile_editorial_notes(profile_id,owner_note) VALUES ($1,$2) ON CONFLICT(profile_id) DO UPDATE SET profile_id=excluded.profile_id,owner_note=excluded.owner_note`,[own,'Private editorial input']));
  await as(db,'authenticated',owner,async()=>assert.equal((await db.query('SELECT owner_note FROM company_profile_editorial_notes')).rows[0].owner_note,'Private editorial input'));
  await assert.rejects(as(db,'anon',null,()=>db.query('SELECT * FROM company_profile_editorial_notes')));
  await as(db,'authenticated',other,async()=>{
   assert.equal((await db.query('SELECT * FROM company_profile_editorial_notes')).rows.length,0);
   assert.equal((await db.query(`UPDATE company_profile_editorial_notes SET owner_note='intrusion' WHERE profile_id=$1 RETURNING profile_id`,[own])).rows.length,0);
  });
  await assert.rejects(as(db,'authenticated',other,()=>db.query('INSERT INTO company_profile_editorial_notes(profile_id,owner_note) VALUES ($1,$2)',[own,'foreign'])));
  await as(db,'authenticated',admin,async()=>{assert.equal((await db.query('SELECT * FROM company_profile_editorial_notes')).rows.length,1);assert.equal((await db.query(`UPDATE company_profile_editorial_notes SET owner_note='admin' RETURNING profile_id`)).rows.length,0)});
  await assert.rejects(as(db,'authenticated',owner,()=>db.query('UPDATE company_profile_editorial_notes SET owner_note=$1',['x'.repeat(4001)])));
  await assert.rejects(as(db,'authenticated',owner,()=>db.query('UPDATE company_profile_editorial_notes SET created_at=now()')));
  await as(db,'authenticated',owner,()=>db.query('UPDATE company_profile_editorial_notes SET owner_note=NULL WHERE profile_id=$1',[own]));
  assert.equal((await db.query('SELECT owner_note FROM company_profile_editorial_notes')).rows[0].owner_note,null);
 }finally{await db.close()}
});

test('atomic owner taxonomy save preserves internal terms/status/foreign profile and is idempotent, invoker only',async()=>{
 const db=await setup();try {
  await as(db,'authenticated',owner,async()=>{
   assert.equal((await db.query('SELECT term_key FROM travel_terms')).rows.length,21);
   await save(db);await save(db);
   const keys=(await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1 ORDER BY term_key',[own])).rows.map(r=>r.term_key);
   assert.deepEqual(keys,['accommodation:hotel','audience:familie','audience:gruppe','audience:mit-hund','feature:pool','theme:radwandern','theme:wellnessangebote']);
  });
  assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[own])).rows[0].status,'draft');
  assert.equal((await db.query('SELECT display_name FROM company_profiles WHERE id=$1',[foreign])).rows[0].display_name,'Foreign');
  await assert.rejects(as(db,'authenticated',owner,()=>save(db,['feature:pool'],{display_name:'Bad'})));
  await assert.rejects(as(db,'authenticated',owner,()=>save(db,[],{display_name:'Bad',company_id:foreign})));
  await assert.rejects(as(db,'authenticated',owner,()=>save(db,[],{display_name:'Bad'},'pending')));
  assert.equal((await db.query('SELECT display_name,business_areas FROM company_profiles WHERE id=$1',[own])).rows[0].display_name,'After');
  await as(db,'anon',null,async()=>assert.equal((await db.query('SELECT * FROM company_profile_travel_terms WHERE profile_id=$1',[own])).rows.length,0));
  await assert.rejects(as(db,'anon',null,()=>save(db)));
  await assert.rejects(as(db,'authenticated',other,()=>db.query('INSERT INTO company_profile_travel_terms VALUES ($1,$2)',[own,'theme:natur-pur'])));
  await as(db,'authenticated',owner,()=>save(db,[]));
  assert.deepEqual((await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1 ORDER BY term_key',[own])).rows.map(r=>r.term_key),['audience:gruppe','feature:pool']);
  assert.equal((await db.query("SELECT prosecdef FROM pg_proc WHERE proname='save_own_travel_profile'")).rows[0].prosecdef,false);
 }finally{await db.close()}
});

test('approved owner cannot reclassify by RPC or direct writes; normal fields still save with null terms',async()=>{
 const db=await setup();try {
  await as(db,'authenticated',owner,()=>save(db));
  await db.exec(`UPDATE company_profiles SET status='approved' WHERE id='${own}'`);
  const before=(await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1 ORDER BY term_key',[own])).rows;
  await assert.rejects(as(db,'authenticated',owner,()=>save(db,[],{display_name:'Bad'},'approved')));
  await assert.rejects(as(db,'authenticated',owner,()=>db.query('INSERT INTO company_profile_travel_terms VALUES ($1,$2)',[own,'theme:natur-pur'])));
  await as(db,'authenticated',owner,()=>db.query('DELETE FROM company_profile_travel_terms WHERE profile_id=$1',[own]));
  await as(db,'authenticated',owner,()=>save(db,null,{display_name:'Allowed'},'approved'));
  assert.deepEqual((await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1 ORDER BY term_key',[own])).rows,before);
  assert.equal((await db.query('SELECT display_name,status FROM company_profiles WHERE id=$1',[own])).rows[0].display_name,'Allowed');
 }finally{await db.close()}
});
