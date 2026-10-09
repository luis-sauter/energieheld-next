import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const admin='33333333-3333-4333-8333-333333333333', owner='11111111-1111-4111-8111-111111111111', foreign='44444444-4444-4444-8444-444444444444';
const profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', asset='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const path=`profiles/${profile}/gallery/${asset}.png`;
let db;
before(async()=>{
 db=new PGlite(); await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,private to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table portal_admins(user_id uuid primary key);insert into portal_admins values('${admin}');alter table portal_admins enable row level security;grant select on portal_admins to authenticated;create policy admins_self on portal_admins for select to authenticated using(user_id=auth.uid());
 create table company_profiles(id uuid primary key,status text,logo_path text,contact_image_path text,video_path text);insert into company_profiles values('${profile}','approved',null,null,null);alter table company_profiles enable row level security;grant select on company_profiles to anon,authenticated;create policy approved_profiles on company_profiles for select using(status='approved');create policy admin_profiles on company_profiles for select to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid()));
 create table company_profile_public_visibility(profile_id uuid primary key,is_listed boolean);grant select on company_profile_public_visibility to anon,authenticated;
 create table media_library_assets(id uuid primary key,profile_id uuid,bucket_id text,storage_path text,kind text,alt_text text,archived_at timestamptz,deletion_requested_at timestamptz,deleted_at timestamptz);
 insert into media_library_assets values('${asset}','${profile}','company-media','${path}','gallery','Original photo',null,null,null);
 alter table media_library_assets enable row level security;grant select,update on media_library_assets to authenticated;create policy admin_assets on media_library_assets for all to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid())) with check(exists(select 1 from portal_admins where user_id=auth.uid()));
 create table storage.objects(bucket_id text,name text);insert into storage.objects values('company-media','${path}');alter table storage.objects enable row level security;grant select on storage.objects to anon,authenticated;create policy admin_storage on storage.objects for select to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid()));
 create table media_library_files(asset_id uuid,bucket_id text,storage_path text);insert into media_library_files values('${asset}','company-media','${path}');
 create table company_profile_images(id uuid,profile_id uuid,storage_path text);create table profile_content_blocks(id uuid,profile_id uuid);create table profile_content_block_images(id uuid,block_id uuid,storage_path text);create table company_ad_campaigns(id uuid,profile_id uuid,image_path text);create table profile_video_uses(id uuid,profile_id uuid,block_id uuid,storage_path text,external_url text);
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261009213520_accommodation_card_images.sql',import.meta.url),'utf8'));
 const catalog=await readFile(new URL('../supabase/migrations/20261009153723_central_media_library.sql',import.meta.url),'utf8');
 const start=catalog.indexOf('CREATE FUNCTION private.guard_media_library_delete_request()');
 const end=catalog.indexOf('CREATE TRIGGER media_library_delete_request',start);
 await db.exec(catalog.slice(start,catalog.indexOf(';',end)+1));

});
after(()=>db.close());beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback'));
async function actor(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role '+role);}
async function denied(sql,args=[]){await db.exec('savepoint deny');await assert.rejects(db.query(sql,args));await db.exec('rollback to savepoint deny;release savepoint deny');}
const insert="insert into company_profile_card_images(profile_id,asset_id,bucket_id,storage_path,focus_x,focus_y,zoom) values($1,$2,'company-media','fake',25,75,1.2)";
test('migration is additive: existing data unchanged, no Storage trigger or public definer function',async()=>{
 assert.equal((await db.query('select count(*)::int n from company_profiles')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from company_profile_card_images')).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal")).rows[0].n,0);
 assert.equal((await db.query("select prosecdef from pg_proc where proname='guard_card_image_reference'")).rows[0].prosecdef,false);
});
test('admin saves true catalog reference and crop without changing gallery, logo, campaign or original',async()=>{
 await actor(admin);await db.query(insert,[profile,asset]);
 const row=(await db.query('select * from company_profile_card_images')).rows[0];assert.equal(row.storage_path,path);assert.equal(row.alt_text,'Original photo');assert.equal(Number(row.focus_x),25);assert.equal(Number(row.zoom),1.2);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from company_profile_images')).rows[0].n,0);assert.equal((await db.query('select logo_path from company_profiles')).rows[0].logo_path,null);assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 const refs=(await db.query("select private.media_library_references('company-media',$1) refs",[path])).rows[0].refs;assert.deepEqual(refs,[{label:'Unterkunftskarte',profileId:profile,id:profile}]);
});
test('owner, foreign and anon cannot create or alter card image references',async()=>{
 for(const id of [owner,foreign]){await actor(id);await denied(insert,[profile,asset]);assert.equal((await db.query("update company_profile_card_images set zoom=2 returning profile_id")).rows.length,0);}
 await actor('','anon');await denied(insert,[profile,asset]);
});
test('public read is only explicit referenced image on approved, listed profile',async()=>{
 await actor('','anon');assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await actor(admin);await db.query(insert,[profile,asset]);await actor('','anon');assert.equal((await db.query('select * from company_profile_card_images')).rows.length,1);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await db.exec('reset role');await db.query("update company_profiles set status='pending'");await actor('','anon');assert.equal((await db.query('select * from company_profile_card_images')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await db.exec('reset role');await db.query("update company_profiles set status='approved'");await db.query('insert into company_profile_public_visibility values($1,false)',[profile]);await actor('','anon');assert.equal((await db.query('select * from storage.objects')).rows.length,0);
});
test('foreign, archived, missing and video sources and invalid crops fail closed',async()=>{
 for(const update of ["profile_id='44444444-4444-4444-8444-444444444444'","archived_at=now()","deleted_at=now()","kind='video'","bucket_id='ad-media'","storage_path='missing.png'"]){
  await db.exec('savepoint variant');await db.exec('reset role');await db.query('update media_library_assets set '+update);await actor(admin);await denied(insert,[profile,asset]);await db.exec('rollback to savepoint variant;release savepoint variant');
 }
 await actor(admin);await db.query(insert,[profile,asset]);await denied('update company_profile_card_images set focus_x=101');await denied('update company_profile_card_images set zoom=0.9');
});
test('replace and cancel semantics: one stable per-profile selection; originals and other uses survive',async()=>{
 await actor(admin);await db.query(insert,[profile,asset]);const before=(await db.query('select * from company_profile_card_images')).rows;
 // Merely browsing cannot write; only explicit upsert changes the selected reference.
 assert.deepEqual((await db.query('select * from company_profile_card_images')).rows,before);
 await db.exec('reset role');const other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';await db.query('insert into media_library_assets select $1,profile_id,bucket_id,$2,kind,alt_text,null,null,null from media_library_assets',[other,path.replace(asset,other)]);await db.query("insert into storage.objects values('company-media',$1)",[path.replace(asset,other)]);
 await actor(admin);await db.query('update company_profile_card_images set asset_id=$1,focus_x=50,focus_y=50,zoom=1',[other]);assert.equal((await db.query('select count(*)::int n from company_profile_card_images')).rows[0].n,1);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,2);assert.equal((await db.query("select private.media_library_references('company-media',$1) refs",[path])).rows[0].refs.length,0);
});

test('existing catalog delete guard recognizes card usage and releases only after reference removal',async()=>{
 await actor(admin);await db.query(insert,[profile,asset]);await db.query('update media_library_assets set archived_at=now() where id=$1',[asset]);
 await denied('update media_library_assets set deletion_requested_at=now() where id=$1',[asset]);
 await db.query('delete from company_profile_card_images where profile_id=$1',[profile]);
 await db.query('update media_library_assets set deletion_requested_at=now() where id=$1',[asset]);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
});
