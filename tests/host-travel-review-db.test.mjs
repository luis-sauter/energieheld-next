import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111', reviewer='22222222-2222-4222-8222-222222222222', editor='33333333-3333-4333-8333-333333333333', other='44444444-4444-4444-8444-444444444444';
const own='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', approved='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const migration=await readFile(new URL('../supabase/migrations/20261008212320_host_travel_proposals_review.sql',import.meta.url),'utf8');
let db;
async function apply(file){await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));}
before(async()=>{
 db=new PGlite();await db.exec(await readFile(new URL('./fixtures/company-schema.sql',import.meta.url),'utf8'));
 await apply('20260916145904_add_company_categories_and_admin_assignment.sql');
 await db.exec(`CREATE SCHEMA private;
 ALTER TABLE company_profiles ADD COLUMN slug text; ALTER TABLE company_profiles ADD COLUMN city text;
 ${['business_areas','tagline','description','phone','public_email','website','street','postal_code','region','country','contact_first_name','contact_last_name'].map(k=>`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS ${k} text; GRANT UPDATE(${k}) ON company_profiles TO authenticated;`).join('\n')}
 GRANT UPDATE(city) ON company_profiles TO authenticated; GRANT SELECT ON company_profiles TO anon;
 ALTER POLICY profiles_owner_update ON company_profiles WITH CHECK(EXISTS(SELECT 1 FROM companies WHERE id=company_id AND owner_user_id=auth.uid()));
 CREATE POLICY profiles_admin_update ON company_profiles FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid()));
 INSERT INTO portal_admins VALUES ('${reviewer}'),('${editor}'); INSERT INTO companies VALUES ('${owner}','${owner}','Owner'),('${other}','${other}','Other');
 INSERT INTO company_profiles(id,company_id,display_name,status) VALUES ('${own}','${owner}','Own','pending'),('${approved}','${other}','Existing','pending');
 SELECT set_config('request.jwt.claim.sub','${reviewer}',false); SELECT review_company_profile_with_categories('${approved}','approved',array['heizung']);
 CREATE TABLE company_profile_images(id uuid PRIMARY KEY,profile_id uuid,storage_path text,alt_text text);
 CREATE TABLE profile_content_blocks(id uuid PRIMARY KEY,profile_id uuid,type text,slot text,content jsonb);
 CREATE TABLE profile_content_block_images(id uuid PRIMARY KEY,block_id uuid,storage_path text,alt_text text,caption text);
 CREATE TABLE company_ad_campaigns(id uuid PRIMARY KEY,internal_name text,submitted_at timestamptz,status text,archived_at timestamptz,is_editorial boolean);
 CREATE TABLE company_quality_requests(profile_id uuid PRIMARY KEY,requested_at timestamptz,status text);
 GRANT SELECT ON company_ad_campaigns,company_quality_requests TO authenticated;`);
 await apply('20260926160000_reiseportal_travel_taxonomy.sql');
 await apply('20261007171657_owner_travel_profile_save.sql');
 await apply('20261004160000_profile_content_freshness.sql');
 await apply('20261004163000_profile_review_conflict.sql');
 await apply('20261004190000_profile_review_invalidation.sql');
 await apply('20261005090000_profile_review_capability.sql');
 await db.exec(`UPDATE portal_admins SET can_review_profiles=true WHERE user_id='${reviewer}';
 INSERT INTO company_profile_travel_terms VALUES ('${approved}','theme:natur-pur'),('${own}','audience:gruppe');`);
 await apply('20261008121238_travel_profile_review.sql');
 await apply('20261008150102_editorial_dashboard_workflow.sql');
 const before=(await db.query('SELECT to_jsonb(p) p FROM company_profiles p ORDER BY id')).rows;
 const terms=(await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows;
 const freshness=(await db.query('SELECT * FROM profile_content_freshness ORDER BY profile_id')).rows;
 await db.exec(migration);
 assert.deepEqual((await db.query('SELECT to_jsonb(p) p FROM company_profiles p ORDER BY id')).rows,before);
 assert.deepEqual((await db.query('SELECT * FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows,terms);
 assert.deepEqual((await db.query('SELECT * FROM profile_content_freshness ORDER BY profile_id')).rows,freshness);
 assert.equal((await db.query('SELECT count(*) n FROM company_profile_travel_proposals')).rows[0].n,0);
});
after(async()=>{await db?.close()});beforeEach(async()=>{await db.exec('RESET ROLE; BEGIN')});afterEach(async()=>{await db.exec('ROLLBACK; RESET ROLE')});
async function actor(user,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);await db.exec('SET LOCAL ROLE '+role);}
async function denied(run,pattern){await db.exec('SAVEPOINT denied');await assert.rejects(run,pattern);await db.exec('ROLLBACK TO SAVEPOINT denied; RELEASE SAVEPOINT denied');}
const snapshot=async(id=own)=>(await db.query('SELECT admin_profile_travel_review($1) s',[id])).rows[0].s;
const ownerSave=(status='pending',terms=['accommodation:hotel','theme:wanderurlaub'])=>db.query('SELECT save_own_travel_profile($1::jsonb,$2::text[],$3)',[JSON.stringify({display_name:'Own'}),terms,status]);
const save=(s,keys=s.assignedKeys,id=own)=>db.query('SELECT save_profile_travel_assignments($1,$2,$3,$4,$5) s',[id,keys,s.assignedKeys,s.proposedKeys,s.revision]);
const decide=(s,decision='approved',feedback=null,id=own)=>db.query('SELECT review_travel_profile_with_proposals($1,$2,$3,$4,$5)',[id,decision,feedback,s.revision,s.proposedKeys]);

test('Owner saves proposals atomically for pending/approved; confirmed history/public filters unchanged; own/private/foreign RLS',async()=>{
 await actor(owner);await ownerSave();await ownerSave();
 assert.deepEqual((await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1',[own])).rows,[{term_key:'audience:gruppe'}]);
 assert.equal((await db.query('SELECT * FROM company_profile_travel_proposals')).rows.length,2);
 await denied(()=>db.query('INSERT INTO company_profile_travel_terms VALUES ($1,$2)',[own,'theme:radwandern']));
 assert.equal((await db.query('DELETE FROM company_profile_travel_terms WHERE profile_id=$1 RETURNING term_key',[own])).rows.length,0);
 await denied(()=>ownerSave('pending',['feature:pool']));
 await denied(()=>ownerSave('draft'));assert.equal((await db.query('SELECT * FROM company_profile_travel_proposals')).rows.length,2);
 await actor(other);assert.equal((await db.query('SELECT * FROM company_profile_travel_proposals')).rows.length,0);
 await denied(()=>db.query('INSERT INTO company_profile_travel_proposals VALUES ($1,$2)',[own,'theme:natur-pur']));
 await actor('','anon');await denied(()=>db.query('SELECT * FROM company_profile_travel_proposals'));
 assert.deepEqual((await db.query('SELECT term_key FROM company_profile_travel_terms')).rows,[{term_key:'theme:natur-pur'}]);
 await actor(editor);await decide(await snapshot());await actor(owner);await ownerSave('approved',['theme:golfurlaub']);
 assert.deepEqual((await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1',[own])).rows,[{term_key:'audience:gruppe'}]);
});

test('Admin snapshot separates actual proposals/history; explicit batch save is atomic, idempotent and never publishes',async()=>{
 await actor(owner);await ownerSave();await actor(editor);const s=await snapshot();
 assert.deepEqual(s.proposedKeys,['accommodation:hotel','theme:wanderurlaub']);assert.deepEqual(s.assignedKeys,['audience:gruppe']);
 const keys=['accommodation:hotel','theme:familienurlaub'];const result=(await save(s,keys)).rows[0].s;
 assert.deepEqual(result.assignedKeys,keys);assert.ok(result.revision>s.revision);
 assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[own])).rows[0].status,'pending');
 const next=await snapshot();await save(next,keys);assert.equal((await snapshot()).revision,next.revision);
 await denied(()=>save(next,[...keys,'theme:invented']));assert.deepEqual((await snapshot()).assignedKeys,keys);
 await denied(()=>save(s,['theme:natur-pur']),/changed/);assert.deepEqual((await snapshot()).assignedKeys,keys);
 await denied(()=>db.query('UPDATE profile_content_freshness SET reviewed_revision=content_revision WHERE profile_id=$1',[own]));
});

test('Changed content/confirmed assignments/host proposals invalidate stale decisions and save snapshots',async()=>{
 await actor(editor);const s=await snapshot();
 await actor(owner);await ownerSave();await actor(editor);
 await denied(()=>save(s,['theme:wanderurlaub']),/changed/);await denied(()=>decide(s),/changed/);
 const withProposals=await snapshot();await db.query('INSERT INTO company_profile_travel_terms VALUES ($1,$2)',[own,'theme:radwandern']);
 await denied(()=>save(withProposals,['theme:wanderurlaub']),/changed/);await denied(()=>decide(withProposals),/changed/);
 const after=await snapshot();await actor(owner);await db.query("UPDATE company_profiles SET description='Updated after review' WHERE id=$1",[own]);await actor(editor);
 await denied(()=>decide(after),/changed/);assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[own])).rows[0].status,'pending');
});

test('Every present/future portal admin may Travel approval; Owner/anon denied; legacy and Freshness capability stay separate',async()=>{
 await actor(editor);assert.equal((await db.query('SELECT can_review_travel_profiles() yes')).rows[0].yes,true);
 await denied(async()=>db.query('SELECT review_profile_content($1,$2)',[own,(await snapshot()).revision]),/authorized/);
 await decide(await snapshot());assert.equal((await db.query('SELECT status,approval_context FROM company_profiles WHERE id=$1',[own])).rows[0].approval_context,'reiseportal');
 await denied(async()=>decide(await snapshot()),/not pending/);
 await db.exec('RESET ROLE');await db.query("INSERT INTO portal_admins(user_id) VALUES ($1)",[other]);
 await db.query("UPDATE company_profiles SET status='pending' WHERE id=$1",[own]);await actor(other);await decide(await snapshot());
 await actor(owner);await denied(()=>db.query('SELECT admin_profile_travel_review($1)',[own]),/authorized/);await denied(()=>db.query('SELECT review_travel_profile_with_feedback($1,$2,$3,$4)',[own,'approved',null,1]),/authorized/);
 await actor('','anon');await denied(()=>db.query('SELECT review_travel_profile_with_proposals($1,$2,$3,$4,$5)',[own,'approved',null,1,[]]));
 await db.exec('RESET ROLE');await denied(async()=>{await db.query('DELETE FROM company_profile_categories WHERE profile_id=$1',[approved]);await db.exec('SET CONSTRAINTS ALL IMMEDIATE');},/requires/);
 assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[approved])).rows[0].status,'approved');
});

test('Private concrete feedback: empty/oversized denied; rejection -> own revision and resubmission retain proposals and confirmed history',async()=>{
 await actor(owner);await ownerSave();await actor(editor);const s=await snapshot();
 await denied(()=>decide(s,'rejected','   '),/required/);await denied(()=>decide(s,'rejected','x'.repeat(4001)),/required/);
 await decide(s,'rejected','Please add exterior photos');await actor(owner);
 assert.equal((await db.query('SELECT message FROM company_profile_review_feedback')).rows[0].message,'Please add exterior photos');
 await ownerSave('rejected');await db.query("UPDATE company_profiles SET status='pending',submitted_at=now() WHERE id=$1 AND status='rejected'",[own]);
 assert.equal((await db.query('SELECT count(*) n FROM company_profile_travel_proposals')).rows[0].n,2);
 assert.deepEqual((await db.query('SELECT term_key FROM company_profile_travel_terms WHERE profile_id=$1',[own])).rows,[{term_key:'audience:gruppe'}]);
 await actor(other);assert.equal((await db.query('SELECT * FROM company_profile_review_feedback')).rows.length,0);
 await actor(editor);await decide(await snapshot());assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[own])).rows[0].status,'approved');
});

test('New public RPCs invoker-only, authenticated/admin bounded, no private-schema usage; no Storage changes or new fake data',async()=>{
 for(const signature of ['admin_profile_travel_review(uuid)','can_review_travel_profiles()','save_profile_travel_assignments(uuid,text[],text[],text[],bigint)','review_travel_profile_with_proposals(uuid,text,text,bigint,text[])']){
 const r=(await db.query("SELECT prosecdef,has_function_privilege('anon',$1,'EXECUTE') AS anon,has_schema_privilege('authenticated','private','USAGE') AS schema_usage FROM pg_proc WHERE oid=$1::regprocedure",[signature])).rows[0];assert.deepEqual(r,{prosecdef:false,anon:false,schema_usage:false});
 }
 await actor(owner);await denied(()=>db.query('SELECT save_profile_travel_assignments($1,$2,$3,$4,$5)',[own,[],[],[],1]),/authorized/);
 assert.doesNotMatch(migration,/UPDATE public.portal_admins|INSERT INTO public.travel_terms|ALTER TABLE storage|CREATE POLICY .* ON storage/i);
});
