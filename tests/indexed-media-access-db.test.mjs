import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';
test('indexed media helper is equivalent for roles/lifecycle/malformed paths; preserves data, policies and privileges',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to anon,authenticated;
 create table companies(id uuid primary key,owner_user_id uuid);
 create table company_profiles(id uuid primary key,company_id uuid);
 create table portal_admins(user_id uuid primary key);
 create table company_ad_campaigns(id uuid primary key,profile_id uuid,is_editorial boolean,status text,archived_at timestamptz,deletion_requested_at timestamptz,image_path text,approved_start_date date,approved_end_date date);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select on storage.objects to anon,authenticated;`);
 const owner=crypto.randomUUID(),admin=crypto.randomUUID(),foreign=crypto.randomUUID(),profile=crypto.randomUUID(),company=crypto.randomUUID();
 await db.query('insert into companies values($1,$2)',[company,owner]);await db.query('insert into company_profiles values($1,$2)',[profile,company]);await db.query('insert into portal_admins values($1)',[admin]);
 const source=await readFile(new URL('../supabase/migrations/20261006120000_ad_campaign_lifecycle.sql',import.meta.url),'utf8');const old=source.slice(source.indexOf('CREATE OR REPLACE FUNCTION public.can_access_ad_media'),source.lastIndexOf('COMMIT;'));
 await db.exec(old);await db.exec(old.replace('public.can_access_ad_media(','public.previous_ad_media_access('));
 await db.exec("revoke all on function can_access_ad_media(text,boolean) from public;grant execute on function can_access_ad_media(text,boolean) to anon,authenticated;create policy ad_read on storage.objects for select to anon,authenticated using(bucket_id='ad-media' and can_access_ad_media(name,false));");
 const paths=[];for(const status of['draft','pending','rejected','approved'])for(const editorial of[false,true])for(const archived of[false,true]){
  const id=crypto.randomUUID(),path=`campaigns/${id}/creative/${crypto.randomUUID()}.png`;paths.push(path);
  await db.query("insert into company_ad_campaigns values($1,$2,$3,$4,case when $5 then now() end,null,$6,(now() at time zone 'Europe/Berlin')::date,(now() at time zone 'Europe/Berlin')::date)",[id,profile,editorial,status,archived,path]);await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[path]);
 }
 await db.exec("insert into company_ad_campaigns(id,is_editorial,status) select gen_random_uuid(),true,'draft' from generate_series(1,250)");
 for(const kind of ['cleanup','expired','future']){
  const id=crypto.randomUUID(),path=`campaigns/${id}/creative/${crypto.randomUUID()}.webp`;paths.push(path);
  await db.query("insert into company_ad_campaigns values($1,$2,false,'approved',case when $3='cleanup' then now() end,case when $3='cleanup' then now() end,$4,(now() at time zone 'Europe/Berlin')::date+case when $3='future' then 1 when $3='expired' then -2 else 0 end,(now() at time zone 'Europe/Berlin')::date+case when $3='future' then 2 when $3='expired' then -1 else 0 end)",[id,profile,kind,path]);await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[path]);
 }
 const snapshot=async()=>(await db.query("select jsonb_build_object('data',(select jsonb_agg(to_jsonb(a) order by id) from company_ad_campaigns a),'files',(select jsonb_agg(to_jsonb(o) order by name) from storage.objects o),'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p),'acl',(select jsonb_build_object('acl',proacl,'owner',proowner,'definer',prosecdef,'settings',proconfig) from pg_proc where oid='can_access_ad_media(text,boolean)'::regprocedure)) as state")).rows[0].state;
 const before=await snapshot();await db.exec(await readFile(new URL('../supabase/migrations/20261011225258_indexed_media_access_lookup.sql',import.meta.url),'utf8'));assert.deepEqual(await snapshot(),before);
 const invalid=[null,'','campaigns/not-a-uuid/creative/x.png',`campaigns/${'a'.repeat(36)}/creative/${crypto.randomUUID()}.png`,paths[0].replace('/creative/','/other/'),paths[0]+'.exe',paths[0].toUpperCase(),paths[0].replace('.png','.svg'),`campaigns/${crypto.randomUUID()}/creative/${crypto.randomUUID()}.png`,paths[0].replace(/[^/]+$/,'-'.repeat(36)+'.png')];
 for(const [role,id]of[['anon',''],['authenticated',owner],['authenticated',foreign],['authenticated',admin]]){
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);
  for(const write of[false,true,null])for(const path of[...paths,...invalid]){const r=(await db.query('select can_access_ad_media($1,$2) as current,previous_ad_media_access($1,$2) as previous',[path,write])).rows[0];assert.equal(r.current,r.previous,`${role},write=${write},path=${path}`);}
  const actual=await db.query('select name from storage.objects');assert.equal(actual.rows.length,role==='anon'||id===foreign?2:id===owner?12:19);
 }
 await db.exec('reset role');const definition=(await db.query("select pg_get_functiondef('can_access_ad_media(text,boolean)'::regprocedure) as definition")).rows[0].definition;assert.match(definition,/a.id\s*=\s*CASE/i);
 // The planner may legitimately scan the small role fixture. Verify the usable
 // existing primary-key path at realistic campaign-history size, without forcing a plan.
 await db.exec("insert into company_ad_campaigns(id,is_editorial,status) select gen_random_uuid(),true,'draft' from generate_series(1,5000); analyze company_ad_campaigns");
 const plan=(await db.query('explain(format json) select id from company_ad_campaigns where id=$1',[crypto.randomUUID()])).rows[0];assert.match(JSON.stringify(plan),/company_ad_campaigns_pkey/);
 }finally{await db.close();}
});
