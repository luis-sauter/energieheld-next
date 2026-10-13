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
 await db.exec((await readFile(new URL('../supabase/migrations/20261009173154_company_profile_public_visibility.sql',import.meta.url),'utf8')).split('-- Preserve every existing document')[0]);
 await apply('20261010200813_company_profile_import_provenance.sql');
 await apply('20261010215919_company_publication_and_catalog_page.sql');
 const seasonBefore=(await db.query('SELECT to_jsonb(p) p FROM company_profiles p ORDER BY id')).rows;
 const assignmentBefore=(await db.query('SELECT profile_id,term_key FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows;
 const freshnessBefore=(await db.query('SELECT * FROM profile_content_freshness ORDER BY profile_id')).rows;
 await apply('20261013160000_company_travel_seasons.sql');
 assert.deepEqual((await db.query('SELECT to_jsonb(p) p FROM company_profiles p ORDER BY id')).rows,seasonBefore);
 assert.deepEqual((await db.query('SELECT profile_id,term_key FROM company_profile_travel_terms ORDER BY profile_id,term_key')).rows,assignmentBefore);
 assert.deepEqual((await db.query('SELECT * FROM profile_content_freshness ORDER BY profile_id')).rows,freshnessBefore);
 assert.equal((await db.query('SELECT count(*) n FROM company_profile_travel_terms WHERE seasonal_teaser IS NOT NULL')).rows[0].n,0);

});
after(async()=>{await db?.close()});beforeEach(async()=>{await db.exec('RESET ROLE; BEGIN')});afterEach(async()=>{await db.exec('ROLLBACK; RESET ROLE')});
async function actor(user,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);await db.exec('SET LOCAL ROLE '+role);}
async function denied(run,pattern){await db.exec('SAVEPOINT denied');await assert.rejects(run,pattern);await db.exec('ROLLBACK TO SAVEPOINT denied; RELEASE SAVEPOINT denied');}
const snapshot=async(id=own)=>(await db.query('SELECT admin_profile_travel_review($1) s',[id])).rows[0].s;
const save=(s,keys=s.assignedKeys,id=own)=>db.query('SELECT save_profile_travel_assignments($1,$2,$3,$4,$5) s',[id,keys,s.assignedKeys,s.proposedKeys,s.revision]);

const winter='theme:saison-winter',summer='theme:saison-sommer';
const saveSeasons=async(s,keys,teasers,id=own)=>(await db.query('SELECT save_profile_travel_seasons($1,$2,$3,$4,$5,$6::jsonb) s',[id,keys,s.assignedKeys,s.proposedKeys,s.revision,JSON.stringify(teasers)])).rows[0].s;
test('season save is admin-only, keeps status and old terms; teaser save increments revision and stale save rolls back',async()=>{
 await actor(editor);const initial=await snapshot(),keys=[...initial.assignedKeys,winter,summer];
 const saved=await saveSeasons(initial,keys,{[winter]:'Ruhige Auszeit im Spa.',[summer]:'Sommerliche Naturtage.'});
 assert.equal((await db.query('SELECT status FROM company_profiles WHERE id=$1',[own])).rows[0].status,'pending');
 assert.deepEqual((await snapshot()).seasonTeasers,saved.seasonTeasers);
 const next=await snapshot();const updated=await saveSeasons(next,keys,{...next.seasonTeasers,[winter]:'Wellness nach kühlen Tagen.'});
 assert.ok(updated.revision>next.revision);await denied(()=>saveSeasons(next,keys,{[winter]:'Stale overwrite'}),/changed/);
 const reloaded=await snapshot();assert.equal(reloaded.seasonTeasers[winter],'Wellness nach kühlen Tagen.');
 assert.equal((await saveSeasons(reloaded,keys,reloaded.seasonTeasers)).revision,reloaded.revision);
 await actor(owner);await denied(()=>saveSeasons(reloaded,keys,{[winter]:'owner'}),/authorized/);
 assert.equal((await db.query('UPDATE company_profile_travel_terms SET seasonal_teaser=$1 WHERE profile_id=$2 RETURNING term_key',['owner',own])).rows.length,0);
 await actor(other);assert.equal((await db.query('UPDATE company_profile_travel_terms SET seasonal_teaser=$1 WHERE profile_id=$2 RETURNING term_key',['foreign',own])).rows.length,0);
 await actor('','anon');await denied(()=>db.query('SELECT save_profile_travel_seasons($1,$2,$3,$4,$5,$6)',[own,[],[],[],1,'{}']));
});
test('public teaser permission follows existing approved-profile RLS; drafts hidden; archive metadata scope unchanged; invalid writes denied',async()=>{
 await actor(editor);await saveSeasons(await snapshot(approved),['theme:natur-pur',winter],{[winter]:'Erholung in kalten Monaten.'},approved);
 await actor('','anon');assert.deepEqual((await db.query('SELECT seasonal_teaser FROM company_profile_travel_terms WHERE term_key=$1',[winter])).rows,[{seasonal_teaser:'Erholung in kalten Monaten.'}]);
 await db.exec('RESET ROLE');await db.query("INSERT INTO company_profile_public_visibility(profile_id,is_listed) VALUES ($1,false)",[approved]);
 await actor('','anon');assert.equal((await db.query('SELECT seasonal_teaser FROM company_profile_travel_terms WHERE term_key=$1',[winter])).rows.length,1); // Historical assignment RLS is preserved; public listings enforce is_listed.
 await actor(editor);const s=await snapshot();
 for(const teasers of [null,[],{[winter]:'x'.repeat(241)},{'theme:natur-pur':'not a season'},{[winter]:'not selected'}])await denied(()=>saveSeasons(s,s.assignedKeys,teasers),/invalid/);
 await denied(()=>db.query("UPDATE company_profile_travel_terms SET seasonal_teaser='Wrong' WHERE profile_id=$1",[own]),/seasonal_teaser_valid/);
 await denied(()=>db.query("UPDATE company_profile_travel_terms SET term_key='theme:natur-pur' WHERE profile_id=$1",[own]),/permission denied/);
 assert.deepEqual((await snapshot()).assignedKeys,s.assignedKeys);
});
test('removing one season leaves other seasons/ordinary terms intact; historical five-argument saves preserve teasers',async()=>{
 await actor(editor);const s=await snapshot();
 await saveSeasons(s,[...s.assignedKeys,winter,summer],{[winter]:'Winterruhe.',[summer]:'Sommerwege.'});
 const next=await snapshot();await save(next,next.assignedKeys);
 assert.equal((await snapshot()).seasonTeasers[winter],'Winterruhe.');
 const remove=await snapshot();await saveSeasons(remove,remove.assignedKeys.filter(k=>k!==winter),{[summer]:'Sommerwege.'});
 const after=await snapshot();assert.ok(after.assignedKeys.includes('audience:gruppe'));assert.ok(after.assignedKeys.includes(summer));assert.ok(!after.assignedKeys.includes(winter));assert.deepEqual(after.seasonTeasers,{[summer]:'Sommerwege.'});
});
test('migration changes no historical records/media/status and replaces only travel freshness projection; no new public definer or search rewrite',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261013160000_company_travel_seasons.sql',import.meta.url),'utf8');
 const previous=await readFile(new URL('../supabase/migrations/20261009180653_media_library_videos_and_companies.sql',import.meta.url),'utf8');
 const body=s=>{const rest=s.slice(s.indexOf('CREATE OR REPLACE FUNCTION private.track_profile_content()'));return rest.slice(0,rest.indexOf('$function$',rest.indexOf('AS $function$')+13)+10).replace(/\r/g,'').trim()};
 assert.equal(body(sql),body(previous).replace("keys:=ARRAY['term_key'];","keys:=ARRAY['term_key','seasonal_teaser'];"));
 assert.doesNotMatch(sql,/storage\.objects|search_public_portal|CREATE TRIGGER|DELETE FROM public\.company_profiles|UPDATE public\.company_profiles/);
 const funcs=(await db.query("SELECT n.nspname,p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN ('save_profile_travel_seasons','admin_profile_travel_review')")).rows;
 for(const f of funcs){assert.equal(f.prosecdef,false);assert.ok(f.proconfig.some(c=>c.startsWith('search_path=')))}
});
