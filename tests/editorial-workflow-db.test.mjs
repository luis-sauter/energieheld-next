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
 await db.exec(migration);
 await db.exec(`ALTER TABLE company_profiles ADD COLUMN city text; GRANT SELECT(city) ON company_profiles TO authenticated; CREATE TABLE profile_content_freshness(profile_id uuid PRIMARY KEY,content_revision bigint); INSERT INTO profile_content_freshness VALUES ('${travel}',3),('${legacy}',2),('${pendingLegacy}',1);
 CREATE TABLE company_ad_campaigns(id uuid PRIMARY KEY,internal_name text,submitted_at timestamptz,status text,archived_at timestamptz,is_editorial boolean);
 CREATE TABLE company_quality_requests(profile_id uuid PRIMARY KEY,requested_at timestamptz,status text);
 GRANT SELECT ON profile_content_freshness,company_ad_campaigns,company_quality_requests TO authenticated;
 INSERT INTO company_ad_campaigns VALUES ('11111111-1111-4111-8111-222222222222','Real request',now(),'pending',NULL,false),('11111111-1111-4111-8111-333333333333','Archived',now(),'pending',now(),false),('11111111-1111-4111-8111-444444444444','Editorial',now(),'pending',NULL,true),('11111111-1111-4111-8111-555555555555','Draft',now(),'draft',NULL,false);
 INSERT INTO company_quality_requests VALUES ('${travel}',now(),'pending');`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261008150102_editorial_dashboard_workflow.sql',import.meta.url),'utf8'));
 return {db,before};
}
async function actor(db,user,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE '+role);}


test('queue counts only live pending decisions, has bounded tasks and admin-only access; company pages searchable and paged',async()=>{
 const {db}=await setup();try{
  await actor(db,reviewer);const q=(await db.query('SELECT editorial_work_queue() q')).rows[0].q;assert.deepEqual(q.counts,{profiles:2,advertising:1,verifications:1,total:4});assert.equal(q.tasks.length,4);assert.ok(q.tasks.every(t=>t.href.startsWith('/admin/')));
  const ads=(await db.query("SELECT editorial_work_queue(1,20,'advertising') q")).rows[0].q;assert.equal(ads.tasks.length,1);assert.equal(ads.tasks[0].name,'Real request');
  const page=(await db.query("SELECT editorial_company_page('pending','Travel',1,'name') q")).rows[0].q;assert.equal(page.count,1);assert.equal(page.profiles[0].id,travel);
  const empty=(await db.query("SELECT editorial_company_page(NULL,'',2,'name') q")).rows[0].q;assert.equal(empty.profiles.length,0);assert.equal(empty.count,3);
  for(const role of ['authenticated','anon']){await actor(db,owner,role);await assert.rejects(db.query('SELECT editorial_work_queue()'));await assert.rejects(db.query("SELECT editorial_company_page(NULL,'',1,'name')"));}
 }finally{await db.close()}
});
test('feedback and rejection atomic; empty/stale/unauthorized decisions rejected; owner sees only own private feedback',async()=>{
 const {db}=await setup();try{
 const decision=(message,revision=3)=>db.query('SELECT review_travel_profile_with_feedback($1,$2,$3,$4)',[travel,'rejected',message,revision]);
 for(const user of [owner,editor]){await actor(db,user);await assert.rejects(decision('Please update'));}
 await actor(db,reviewer);await assert.rejects(decision(''));await assert.rejects(decision('Please update',2));
 assert.equal((await db.query('SELECT count(*) n FROM company_profile_review_feedback')).rows[0].n,0);
 await decision('Please update');assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[travel])).rows[0].status,'rejected');
 await actor(db,owner);assert.equal((await db.query('SELECT message FROM company_profile_review_feedback')).rows[0].message,'Please update');await assert.rejects(db.query("UPDATE company_profile_review_feedback SET message='fake'"));
 await actor(db,'44444444-4444-4444-8444-444444444444');assert.equal((await db.query('SELECT * FROM company_profile_review_feedback')).rows.length,0);
 await actor(db,'','anon');await assert.rejects(db.query('SELECT * FROM company_profile_review_feedback'));
 }finally{await db.close()}
});
test('revision-checked approval reuses travel rule, never invents categories; invalid decision rolls back feedback',async()=>{
 const {db}=await setup();try{
 await actor(db,reviewer);await assert.rejects(db.query('SELECT review_travel_profile_with_feedback($1,$2,$3,$4)',[travel,'approved',null,2]));
 await db.query('SELECT review_travel_profile_with_feedback($1,$2,$3,$4)',[travel,'approved',null,3]);
 assert.equal((await db.query('SELECT status,approval_context FROM company_profiles WHERE id=$1',[travel])).rows[0].approval_context,'reiseportal');
 assert.equal((await db.query('SELECT count(*) n FROM company_profile_categories WHERE profile_id=$1',[travel])).rows[0].n,0);
 const before=(await db.query('SELECT * FROM company_profile_categories')).rows;await assert.rejects(db.query('SELECT review_travel_profile_with_feedback($1,$2,$3,$4)',[pendingLegacy,'fake','message',1]));assert.deepEqual((await db.query('SELECT * FROM company_profile_categories')).rows,before);
 }finally{await db.close()}
});
