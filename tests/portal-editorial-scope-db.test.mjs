import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;const admin='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
async function actor(role,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);}
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;
 create table portal_admins(user_id uuid);create table company_profiles(id uuid primary key,display_name text,submitted_at timestamptz,status text);create table company_ad_campaigns(id uuid primary key,internal_name text,submitted_at timestamptz,status text,request_status text,archived_at timestamptz,is_editorial boolean);create table company_quality_requests(profile_id uuid,requested_at timestamptz,status text);
 grant select on portal_admins,company_profiles,company_ad_campaigns,company_quality_requests to authenticated;
 alter table company_profiles enable row level security;alter table company_ad_campaigns enable row level security;
 create policy admin_profiles on company_profiles for select to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid()));create policy admin_ads on company_ad_campaigns for select to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid()));`);
 await db.query('insert into portal_admins values($1)',[admin]);
 await db.query("insert into company_profiles values($1,'Profil',now(),'pending')",[owner]);await db.query("insert into company_quality_requests values($1,now(),'pending')",[owner]);
 for(let i=1;i<=26;i++)await db.query("insert into company_ad_campaigns values($1,$2,now()+$3*interval '1 second','draft','new',null,false)",['aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0'),'Anfrage '+i,i]);
 const old=(await readFile(new URL('../supabase/migrations/20261010090721_public_offer_requests.sql',import.meta.url),'utf8')).match(/CREATE OR REPLACE FUNCTION public.editorial_work_queue[\s\S]*?\$\$;/)[0];await db.exec(old);
 await db.exec(await readFile(new URL('../supabase/migrations/20261110153921_portal_editorial_queue_scope.sql',import.meta.url),'utf8'));
});
after(async()=>db?.close());
test('portal count and pagination omit verification before limiting, original queue retains it',async()=>{
 await actor('authenticated',admin);const page=async n=>(await db.query('select portal_editorial_work_queue($1,20,null) q',[n])).rows[0].q;
 const a=await page(1),b=await page(2);assert.deepEqual(a.counts,{profiles:1,advertising:26,verifications:0,total:27});assert.equal(a.tasks.length,20);assert.equal(b.tasks.length,7);assert.equal(new Set([...a.tasks,...b.tasks].map(t=>t.id)).size,27);assert.ok([...a.tasks,...b.tasks].every(t=>t.kind!=='verification'));
 const original=(await db.query('select editorial_work_queue() q')).rows[0].q;assert.equal(original.counts.verifications,1);assert.equal(original.counts.total,28);assert.equal((await db.query('select count(*)::int n from company_quality_requests')).rows[0].n,1);
});
test('portal RPC is admin-only and rejects unsupported filters and limits',async()=>{
 for(const [role,id]of [['anon',''],['authenticated',owner]]){await actor(role,id);await assert.rejects(db.query('select portal_editorial_work_queue()'));}
 await actor('authenticated',admin);for(const args of [[1,20,'verification'],[0,20,null],[1,21,null]])await assert.rejects(db.query('select portal_editorial_work_queue($1,$2,$3)',args));
 const ads=(await db.query("select portal_editorial_work_queue(2,20,'advertising') q")).rows[0].q;assert.equal(ads.tasks.length,6);assert.ok(ads.tasks.every(t=>t.kind==='advertising'));
});
