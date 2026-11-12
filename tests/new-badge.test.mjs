import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
const {newBadgeVisible,validBadgeExpiry}=await import('../src/lib/new-badge.ts');
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const id='00000000-0000-0000-0000-000000000001',admin='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003';
test('manual badge overrides defaults, removes badges, expires exactly, and does not mark weekly Basics',()=>{
 const start=Date.parse('2026-11-12T10:00:00Z'),row={kind:'profile',entity_id:id,enabled:true,starts_at:new Date(start).toISOString(),expires_at:new Date(start+1000).toISOString(),revision:1};
 assert(newBadgeVisible(id,'profile',[row],start));assert(!newBadgeVisible(id,'profile',[row],start-1));assert(!newBadgeVisible(id,'profile',[row],start+1000));
 assert(!newBadgeVisible(id,'profile',[{...row,enabled:false}],start));assert(!newBadgeVisible(id,'basic',[],start));
 assert(validBadgeExpiry(new Date(start+14*86400000).toISOString(),start));assert(!validBadgeExpiry(new Date(start).toISOString(),start));assert(!validBadgeExpiry('invalid',start));assert(!validBadgeExpiry(new Date(start+367*86400000).toISOString(),start));
 const profile='0c8598b3-a2d2-45ad-bcbb-e19c4ee80e84',banner='8011b97d-e715-4b6c-be3b-67c0cb075340';
 assert(!newBadgeVisible(banner,'banner',[{...row,entity_id:profile,enabled:false}],start));
 assert(newBadgeVisible(banner,'banner',[{...row,entity_id:profile,enabled:false},{...row,kind:'banner',entity_id:banner}],start));
});
test('badge SQL enforces admin, target visibility, expiry, revision and audit without direct write grants',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA private;CREATE SCHEMA auth;
 GRANT USAGE ON SCHEMA private,auth TO anon,authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TABLE public.portal_admins(user_id uuid);INSERT INTO public.portal_admins VALUES('${admin}');GRANT SELECT ON public.portal_admins TO anon,authenticated;
 CREATE TABLE public.company_profiles(id uuid,status text);INSERT INTO public.company_profiles VALUES('${id}','approved'),('${other}','draft');
 CREATE TABLE public.company_profile_public_visibility(profile_id uuid,is_listed boolean);
 CREATE TABLE public.company_ad_campaigns(id uuid,status text,archived_at timestamptz,deletion_requested_at timestamptz,request_status text);
 CREATE TABLE public.basic_accommodation_contacts(id uuid,is_listed boolean,rights_valid_until timestamptz);`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261112131339_editorial_new_badges.sql',import.meta.url),'utf8'));
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT public.save_editorial_new_badge($1,$2,true,now()+interval \'14 days\',0)',['profile',id]),/permission denied/);await db.exec('RESET ROLE');
 await db.exec(`SET ROLE authenticated;SET test.uid='${other}'`);await assert.rejects(db.query('SELECT public.save_editorial_new_badge($1,$2,true,now()+interval \'14 days\',0)',['profile',id]),/Admin required/);
 await assert.rejects(db.exec(`INSERT INTO public.editorial_new_badges(kind,entity_id,expires_at)VALUES('profile','${id}',now()+interval '1 day')`),/permission denied/);
 await db.exec(`SET test.uid='${admin}'`);
 const saved=await db.query('SELECT public.save_editorial_new_badge($1,$2,true,now()+interval \'14 days\',0) AS row',['profile',id]);assert.equal(saved.rows[0].row.revision,1);
 await assert.rejects(db.query('SELECT public.save_editorial_new_badge($1,$2,false,null,0)',['profile',id]),/Badge changed/);
 await assert.rejects(db.query('SELECT public.save_editorial_new_badge($1,$2,true,now()-interval \'1 day\',1)',['profile',id]),/Invalid expiry/);
 await db.query('SELECT public.save_editorial_new_badge($1,$2,false,null,1)',['profile',id]);
 await db.query('SELECT public.save_editorial_new_badge($1,$2,true,now()+interval \'14 days\',0)',['profile',other]);
 await db.exec('RESET ROLE;SET ROLE anon');const visible=await db.query('SELECT entity_id,enabled FROM public.editorial_new_badges');assert.deepEqual(visible.rows,[{entity_id:id,enabled:false}]);
 await assert.rejects(db.exec('SELECT * FROM private.editorial_new_badge_events'),/permission denied/);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int AS n FROM private.editorial_new_badge_events')).rows[0].n,3);
 }finally{await db.close();}
});
