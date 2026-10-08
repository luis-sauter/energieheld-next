import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',reviewer='22222222-2222-4222-8222-222222222222',editor='33333333-3333-4333-8333-333333333333';
const travel='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',legacy='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',pendingLegacy='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const migration=await readFile(new URL('../supabase/migrations/20261008121238_travel_profile_review.sql',import.meta.url),'utf8');
async function setup(){
 const db=new PGlite(); await db.exec(await readFile(new URL('./fixtures/company-schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20260916145904_add_company_categories_and_admin_assignment.sql',import.meta.url),'utf8'));
 await db.exec(`CREATE SCHEMA private; ALTER TABLE portal_admins ADD COLUMN can_review_profiles boolean NOT NULL DEFAULT false;
 GRANT SELECT(can_review_profiles) ON portal_admins TO authenticated;
 INSERT INTO portal_admins VALUES ('${reviewer}',true),('${editor}',false);
 INSERT INTO companies VALUES ('${owner}','${owner}','Owner');
 INSERT INTO company_profiles(id,company_id,display_name,status) VALUES ('${travel}','${owner}','Travel','pending'),('${legacy}','${owner}','Legacy','pending'),('${pendingLegacy}','${owner}','Legacy Pending','pending');
 SELECT set_config('request.jwt.claim.sub','${reviewer}',false);
 SELECT review_company_profile_with_categories('${legacy}','approved',array['heizung']);
 CREATE POLICY profiles_admin_update ON company_profiles FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid()));`);
 const before=(await db.query('SELECT * FROM company_profiles ORDER BY id')).rows;
 await db.exec(migration);return {db,before};
}
async function actor(db,user,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE '+role);}
const review=(db,id,decision='approved')=>db.query('SELECT review_travel_company_profile($1,$2) as decision',[id,decision]);
test('additive migration preserves existing statuses/categories; explicit travel approval needs no fake category; later owned edits work',async()=>{
 const {db,before}=await setup();try{
 const after=(await db.query('SELECT * FROM company_profiles ORDER BY id')).rows;assert.deepEqual(after.map(p=>{const row={...p};delete row.approval_context;return row}),before);assert.ok(after.every(p=>p.approval_context==='energyheld'));
 await actor(db,reviewer);assert.equal((await review(db,travel)).rows[0].decision,'approved');
 await db.exec('RESET ROLE');const rows=(await db.query('SELECT * FROM company_profiles ORDER BY id')).rows;assert.equal(rows.find(p=>p.id===travel).approval_context,'reiseportal');assert.equal(rows.find(p=>p.id===legacy).approval_context,'energyheld');assert.deepEqual((await db.query('SELECT profile_id,category_id FROM company_profile_categories')).rows,[{profile_id:legacy,category_id:'heizung'}]);
 await db.exec(`ALTER POLICY profiles_owner_update ON company_profiles WITH CHECK(EXISTS(SELECT 1 FROM companies WHERE id=company_id AND owner_user_id=auth.uid()));`);
 await actor(db,owner);await db.query("UPDATE company_profiles SET display_name='Travel revised' WHERE id=$1",[travel]);await assert.rejects(db.query("UPDATE company_profiles SET approval_context='reiseportal' WHERE id=$1",[legacy]));
 }finally{await db.close()}
});
test('anonymous/owner/editor without capability denied; unknown/draft/approved target and invalid decision denied; rejection does not opt in',async()=>{
 const {db}=await setup();try{
 for(const [user,role]of [[owner,'authenticated'],[editor,'authenticated'],['','anon']]){await actor(db,user,role);await assert.rejects(review(db,travel));}
 await actor(db,reviewer);await assert.rejects(review(db,legacy));await assert.rejects(review(db,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'));await assert.rejects(review(db,travel,'draft'));await assert.rejects(review(db,travel,null));
 await db.exec('RESET ROLE');await db.query("UPDATE company_profiles SET status='draft' WHERE id=$1",[travel]);await actor(db,reviewer);await assert.rejects(review(db,travel));
 await db.exec('RESET ROLE');await db.query("UPDATE company_profiles SET status='pending' WHERE id=$1",[travel]);await actor(db,reviewer);await review(db,travel,'rejected');await db.exec('RESET ROLE');assert.equal((await db.query('SELECT approval_context,status FROM company_profiles WHERE id=$1',[travel])).rows[0].approval_context,'energyheld');
 }finally{await db.close()}
});
test('legacy RPC and deferred category integrity still require canonical categories; no privilege or policy widening',async()=>{
 const {db}=await setup();try{
 await actor(db,reviewer);await assert.rejects(db.query("SELECT review_company_profile_with_categories($1,'approved',array[]::text[])",[pendingLegacy]));await assert.rejects(db.query("SELECT review_company_profile($1,'approved')",[pendingLegacy]));
 await db.query("SELECT review_company_profile_with_categories($1,'approved',array['solar'])",[pendingLegacy]);await db.exec('RESET ROLE');await assert.rejects(db.query('DELETE FROM company_profile_categories WHERE profile_id=$1',[legacy]));
 const rights=(await db.query("SELECT has_column_privilege('authenticated','company_profiles','approval_context','UPDATE') as write,has_function_privilege('anon','review_travel_company_profile(uuid,text)','EXECUTE') as anonymous")).rows[0];assert.deepEqual(rights,{write:false,anonymous:false});
 const surface=(await db.query("SELECT p.prosecdef,has_schema_privilege('authenticated','private','USAGE') AS schema_usage FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='review_travel_company_profile'")).rows[0];assert.deepEqual(surface,{prosecdef:false,schema_usage:false});
 assert.doesNotMatch(migration,/ALTER POLICY|DISABLE ROW LEVEL|DELETE FROM public.company_profile_categories|UPDATE public.portal_admins/i);
 }finally{await db.close()}
});
