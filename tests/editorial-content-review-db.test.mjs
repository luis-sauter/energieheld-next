import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import './helpers/load-ts.mjs';
import {freshnessStatus,freshnessDueDate} from '../src/lib/content-freshness.ts';
const sql=await readFile(new URL('../supabase/migrations/20261008193336_editorial_content_review_page.sql',import.meta.url),'utf8');
const admin='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const id=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
async function setup(){
 const db=new PGlite();await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 CREATE TABLE portal_admins(user_id uuid PRIMARY KEY); INSERT INTO portal_admins VALUES ('${admin}');
 ALTER TABLE portal_admins ENABLE ROW LEVEL SECURITY; CREATE POLICY admin_self ON portal_admins FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid())); GRANT SELECT ON portal_admins TO authenticated;
 CREATE TABLE company_profiles(id uuid PRIMARY KEY,display_name text NOT NULL,city text,status text NOT NULL,owner_id uuid);
 ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY; CREATE POLICY profile_read ON company_profiles FOR SELECT TO authenticated USING(status='approved' OR owner_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM portal_admins WHERE user_id=(SELECT auth.uid())));
 GRANT SELECT ON company_profiles TO authenticated;
 CREATE TABLE profile_content_freshness(profile_id uuid PRIMARY KEY REFERENCES company_profiles(id),content_revision bigint NOT NULL,content_updated_at timestamptz,content_update_source text,reviewed_revision bigint,reviewed_at timestamptz,review_invalidated_at timestamptz);
 ALTER TABLE profile_content_freshness ENABLE ROW LEVEL SECURITY; CREATE POLICY profile_freshness_admin_read ON profile_content_freshness FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM portal_admins WHERE user_id=auth.uid())); GRANT SELECT ON profile_content_freshness TO authenticated;`);
 await db.exec(sql);return db;
}
async function actor(db,user=admin,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE '+role);}
async function page(db,reviewed=false,n=1,now='2026-10-08T12:00:00Z'){return (await db.query('SELECT editorial_content_review_page($1,$2,$3) result',[reviewed,n,now])).rows[0].result;}
function firstRows(plan){return [plan,...(plan.Plans??[]).flatMap(firstRows)].map(p=>({node:p['Node Type'],rows:p['Actual Rows'],sort:p['Sort Method']}));}
const base={content_revision:2,content_updated_at:null,content_update_source:null,reviewed_revision:2,reviewed_at:'2026-10-01T12:00:00Z',review_invalidated_at:null};
test('DB page sizes 0/1/20/21/1000, missing Freshness, stable equal names, filter and page switches; no publication writes',async()=>{
 const db=await setup();try{
 for(const n of [0,1,20,21,1000]){
  await db.exec('RESET ROLE; DELETE FROM profile_content_freshness; DELETE FROM company_profiles;');
  if(n)await db.query(`INSERT INTO company_profiles SELECT ('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(i::text,12,'0'))::uuid,'Same name',NULL,'approved',NULL FROM generate_series(1,$1) i`,[n]);
  await db.query('INSERT INTO company_profiles VALUES ($1,$2,NULL,$3,NULL)',[id(9999),'Pending','pending']);
  const snapshot=(await db.query('SELECT * FROM company_profiles ORDER BY id')).rows;
  await actor(db);const first=await page(db),second=await page(db,false,2);
  assert.equal(first.count,n);assert.equal(first.rows.length,Math.min(n,20));assert.equal(second.count,n);assert.equal(second.rows.length,Math.min(Math.max(n-20,0),20));
  assert.deepEqual(first.rows.map(r=>r.id),Array.from({length:Math.min(n,20)},(_,i)=>id(i+1)));
  assert.deepEqual(await page(db),first);assert.ok(first.rows.every(r=>r.freshness===null&&r.review_status==='Noch nicht geprüft'));
  assert.deepEqual(await page(db,true),{count:0,rows:[]});assert.deepEqual(await page(db,false,100000),{count:n,rows:[]});
  assert.deepEqual((await db.query('SELECT * FROM company_profiles ORDER BY id')).rows,snapshot);
 }
 // A real reviewed row moves into the checked view without changing publication.
 await db.exec('RESET ROLE');await db.query('INSERT INTO profile_content_freshness(profile_id,content_revision,reviewed_revision,reviewed_at) VALUES ($1,2,2,$2)',[id(1),base.reviewed_at]);await actor(db);
 assert.equal((await page(db,true)).count,1);assert.equal((await page(db)).count,999);
 assert.equal((await db.query("SELECT count(*) n FROM company_profiles WHERE status='approved'")).rows[0].n,1000);
 // Explain the actual RPC body, not just a Function Scan wrapper.
 await db.exec('RESET ROLE; ANALYZE company_profiles; ANALYZE profile_content_freshness');await actor(db);
 const body=sql.slice(sql.indexOf('WITH classified'),sql.indexOf('  RETURN result;')).replace(' INTO result','').replaceAll('p_reviewed','false').replaceAll('p_page','1').replaceAll('p_now',"timestamptz '2026-10-08T12:00:00Z'");
 const plan=(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+body)).rows[0]['QUERY PLAN'][0];
 assert.ok(plan['Plan']);console.log('1000-profile review plan:',JSON.stringify({execution_ms:plan['Execution Time'],temp_blocks:plan.Plan['Temp Written Blocks'],rows:firstRows(plan.Plan)}));
 }finally{await db.close()}
});
test('SQL and exact existing JS status parity: precedence, five states, UTC/leap anniversaries, milliseconds and session zones',async()=>{
 const db=await setup();try{
 await db.query('INSERT INTO company_profiles VALUES ($1,$2,NULL,$3,NULL)',[id(1),'Parity','approved']);
 const cases=[{...base,reviewed_at:null},{...base,review_invalidated_at:'2026-10-02'}, {...base,content_revision:3},{...base,reviewed_revision:null},{...base,reviewed_at:'2020-01-01T00:00:00Z'},base,{...base,reviewed_at:null,review_invalidated_at:'2026-10-02'}, {...base,content_revision:3,review_invalidated_at:'2026-10-02'}];
 for(const reviewed_at of ['2024-02-29T23:59:59.123456Z','2023-02-28T12:34:56.999999Z','2025-03-30T03:30:00+02:00','2024-02-29T00:30:00+01:00','2025-10-26T01:30:00-05:00'])cases.push({...base,reviewed_at});
 const seen=new Set();
 for(const zone of ['UTC','Europe/Berlin','America/New_York']){
  await db.query("SELECT set_config('TimeZone',$1,false)",[zone]);
  for(const state of cases){
   await db.exec('RESET ROLE; DELETE FROM profile_content_freshness');
   await db.query('INSERT INTO profile_content_freshness VALUES ($1,$2,$3,$4,$5,$6,$7)',[id(1),...['content_revision','content_updated_at','content_update_source','reviewed_revision','reviewed_at','review_invalidated_at'].map(k=>state[k])]);await actor(db);
   const deadline=state.reviewed_at?new Date(freshnessDueDate(state.reviewed_at)).getTime():new Date('2026-10-08').getTime();
   for(const delta of [-1,0,1]){
    const now=new Date(deadline+delta),expected=freshnessStatus(state,now);seen.add(expected);
    const result=await page(db,expected==='Aktuell geprüft',1,now.toISOString());assert.equal(result.count,1,JSON.stringify({zone,state,now,delta,expected,other:await page(db,expected!=="Aktuell geprüft",1,now.toISOString())}));assert.equal(result.rows[0].review_status,expected);
    assert.equal((await page(db,expected!=='Aktuell geprüft',1,now.toISOString())).count,0);
   }
  }
 }
 assert.equal(seen.size,5);
 }finally{await db.close()}
});
test('invoker/admin authorization, owner/anon denied, RLS and read-only privileges unchanged; invalid pages fail',async()=>{
 const db=await setup();try{
 await db.query('INSERT INTO company_profiles VALUES ($1,$2,NULL,$3,$4)',[id(1),'Own','approved',owner]);await actor(db);
 for(const [reviewed,n,now] of [[null,1,'2026-01-01'],[false,null,'2026-01-01'],[false,0,'2026-01-01'],[false,100001,'2026-01-01'],[false,1,null],[false,1,'infinity']])await assert.rejects(page(db,reviewed,n,now),e=>e.code==='22023');
 await actor(db,owner);await assert.rejects(page(db),e=>e.code==='42501');assert.equal((await db.query('SELECT * FROM profile_content_freshness')).rows.length,0);
 await actor(db,'','anon');await assert.rejects(page(db),e=>e.code==='42501');await assert.rejects(db.query('SELECT * FROM profile_content_freshness'));
 await db.exec('RESET ROLE');const fn=(await db.query("SELECT prosecdef,provolatile FROM pg_proc WHERE proname='editorial_content_review_page'")).rows[0];assert.equal(fn.prosecdef,false);assert.equal(fn.provolatile,'s');
 assert.equal((await db.query("SELECT has_function_privilege('anon','editorial_content_review_page(boolean,integer,timestamptz)','execute') ok")).rows[0].ok,false);
 assert.doesNotMatch(sql,/CREATE POLICY|ALTER TABLE|UPDATE public|INSERT INTO|DELETE FROM|SECURITY DEFINER/);
 }finally{await db.close()}
});
