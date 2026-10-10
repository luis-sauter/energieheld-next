import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMediaTestDatabase} from './helpers/media-database.mjs';
const admin='33333333-3333-4333-8333-333333333333',owner='11111111-1111-4111-8111-111111111111',profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const path='profiles/'+profile+'/video/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4';
let db;
before(async()=>{
 db=await createMediaTestDatabase(true); await db.exec("alter table storage.objects add metadata jsonb; insert into storage.buckets(id) values('company-profile-videos')");
 await db.exec("alter table companies alter owner_user_id drop not null;alter table company_profiles add column if not exists slug text unique,add column if not exists approval_context text default 'energyheld',add column if not exists city text,add column if not exists country text default 'Deutschland',add column if not exists website text,add column if not exists video_path text,add column if not exists contact_image_path text; grant update(video_path) on company_profiles to authenticated; create policy profiles_qa_admin_update on company_profiles for update to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid()));");
 await db.exec("create table profile_content_blocks(id uuid primary key default gen_random_uuid(),profile_id uuid references company_profiles(id),type text,slot text,sort_order integer default 0,content jsonb,config jsonb);create table profile_content_block_images(id uuid primary key default gen_random_uuid(),block_id uuid,storage_path text,alt_text text,sort_order integer default 0,focus_x numeric,focus_y numeric,zoom numeric,caption text);create table company_ad_campaigns(id uuid primary key,profile_id uuid,image_path text);");
 await db.query('insert into portal_admins values($1)',[admin]);await db.query('insert into companies values($1,$1,$2)',[owner,'Firma']);await db.query('insert into company_profiles(id,company_id,display_name) values($1,$2,$3)',[profile,owner,'Firma']);
 await db.exec(await readFile(new URL('../supabase/migrations/20261009153723_central_media_library.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../supabase/migrations/20261009180653_media_library_videos_and_companies.sql',import.meta.url),'utf8');
 // Use exact verified live CHECK definitions on the intentionally minimal fixture.
 for(const name of ['profile_content_blocks_type_check','profile_content_text_shape','profile_content_image_config']) await db.exec('alter table profile_content_blocks add constraint '+name+' check(true)');
 const freshness=await readFile(new URL('../supabase/migrations/20261004160000_profile_content_freshness.sql',import.meta.url),'utf8');
 await db.exec(freshness.slice(0,freshness.indexOf('CREATE FUNCTION private.track_profile_content')));
 const seedIds=[...migration.matchAll(/\('([0-9a-f-]{36})'::uuid,'https:/g)].map(m=>m[1]);
 for(const id of seedIds) await db.query("insert into company_profiles(id,company_id,display_name) values($1,$2,$3) on conflict do nothing",[id,owner,'Joomla fixture']);
 await db.exec(migration);
 const optimized=await readFile(new URL('../supabase/migrations/20261010215919_company_publication_and_catalog_page.sql',import.meta.url),'utf8');
 await db.exec(optimized.slice(optimized.indexOf('CREATE OR REPLACE FUNCTION public.media_library_page')));

 await db.exec("create policy qa_video_read on storage.objects for select to authenticated using(bucket_id='company-profile-videos' and exists(select 1 from portal_admins where user_id=auth.uid()));");
 await db.exec("grant select on company_ad_campaigns to authenticated;grant select,insert,update,delete on profile_content_blocks,profile_content_block_images to authenticated");
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos',$1,$2)",[path,{size:1000,mimetype:'video/mp4'}]);
});
after(async()=>db?.close());beforeEach(async()=>db.exec('begin'));afterEach(async()=>db.exec('rollback'));
async function actor(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role '+role);}
async function denied(sql,args=[]){await db.exec('savepoint deny');await assert.rejects(db.query(sql,args));await db.exec('rollback to savepoint deny;release savepoint deny');}
test('company creation is atomic, ownerless Reiseportal draft and deliberate duplicate override',async()=>{
 await actor(admin);const a=(await db.query("select media_library_create_company('Neue Pension','Berlin','Deutschland','https://example.org') v")).rows[0].v;
 const p=(await db.query('select * from company_profiles where id=$1',[a.id])).rows[0];assert.equal(p.status,'draft');assert.equal(p.approval_context,'reiseportal');assert.equal(p.city,'Berlin');
 assert.equal((await db.query('select owner_user_id from companies where id=$1',[p.company_id])).rows[0].owner_user_id,null);
 assert.equal((await db.query("select media_library_create_company('Neue Pension') v")).rows[0].v.matches.length,1);
 assert.notEqual((await db.query("select media_library_create_company('Neue Pension','','','',true) v")).rows[0].v.id,a.id);
 await denied("select media_library_create_company('Bad','','','javascript:alert(1)')");
});
test('non-admin and anon cannot create companies or catalog videos',async()=>{
 await actor(owner);await denied("select media_library_create_company('Forbidden')");await denied('select media_library_register_video($1,$2,$3,$4)',[profile,path,'Video','a'.repeat(64)]);
 await actor('','anon');await denied("select media_library_create_company('Forbidden')");
});
test('multiple catalog videos remain originals after removing header usage; no Storage trigger',async()=>{
 await actor(admin);const a=(await db.query('select media_library_register_video($1,$2,$3,$4) id',[profile,path,'Film','a'.repeat(64)])).rows[0].id;
 assert.equal((await db.query("select media_library_page($1,'video') v",[profile])).rows[0].v.count,1);
 assert.equal((await db.query("select media_library_page($1,'images') v",[profile])).rows[0].v.count,0);
 await db.query('select media_library_use_video($1,$2)',[profile,a]);
 assert.equal((await db.query('select video_path from company_profiles where id=$1',[profile])).rows[0].video_path,path);
 await db.query('update company_profiles set video_path=null where id=$1',[profile]);
 assert.equal((await db.query("select count(*)::int n from media_library_assets where bucket_id='company-profile-videos'")).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal")).rows[0].n,0);
});
test('external catalog accepts only canonical YouTube/Vimeo URLs and refuses raw embeds',async()=>{
 await actor(admin);for(const url of ['https://www.youtube.com/watch?v=A1234567890','https://vimeo.com/123456789']) await db.query("insert into media_library_assets(profile_id,bucket_id,storage_path,kind,name) values($1,'external-video',$2,'video','Film')",[profile,url]);
 for(const url of ['javascript:alert(1)','https://evil.example/embed/id','<iframe src=x>']) await denied("insert into media_library_assets(profile_id,bucket_id,storage_path,kind,name) values($1,'external-video',$2,'video','Film')",[profile,url]);
 assert.equal((await db.query("select media_library_page($1,'video') v",[profile])).rows[0].v.count,2);
});

test('video block uses are approved-only, admin-only writes, retain originals and increment freshness',async()=>{
 const block='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 await actor(admin);const a=(await db.query('select media_library_register_video($1,$2,$3,$4) id',[profile,path,'Film','a'.repeat(64)])).rows[0].id;
 await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values($1,$2,'video',$3,$4)",[block,profile,{text:'',title:'Film'},{width_percent:50,offset_percent:25,text_align:'center',spacing_top:'normal',spacing_bottom:'normal'}]);
 await db.query('select media_library_use_video($1,$2,$3)',[profile,a,block]);
 assert.equal((await db.query('select content_revision from profile_content_freshness where profile_id=$1',[profile])).rows[0].content_revision,2);
 await actor('','anon');assert.equal((await db.query('select * from profile_video_uses')).rows.length,0);assert.equal((await db.query("select * from storage.objects where name=$1",[path])).rows.length,0);
 await actor(owner);await denied('select media_library_use_video($1,$2,$3)',[profile,a,block]);assert.equal((await db.query('delete from profile_video_uses where block_id=$1 returning id',[block])).rows.length,0);
 await actor(admin);await db.query('delete from profile_video_uses where block_id=$1',[block]);
 assert.equal((await db.query('select content_revision from profile_content_freshness where profile_id=$1',[profile])).rows[0].content_revision,3);
 assert.equal((await db.query('select id from media_library_assets where id=$1',[a])).rows.length,1);
 assert.equal((await db.query('select name from storage.objects where name=$1',[path])).rows.length,1);
});
test('video block duplicate shares original and layout; removing one use keeps the other',async()=>{
 const block='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';await actor(admin);
 const a=(await db.query('select media_library_register_video($1,$2,$3,$4) id',[profile,path,'Film','a'.repeat(64)])).rows[0].id;
 await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values($1,$2,'video',$3,$4)",[block,profile,{text:'Description',title:'Title'},{width_percent:75,offset_percent:25,text_align:'right',spacing_top:'small',spacing_bottom:'large'}]);
 await db.query('select media_library_use_video($1,$2,$3)',[profile,a,block]);const copy=(await db.query('select duplicate_profile_content_block($1,$2) id',[profile,block])).rows[0].id;
 assert.deepEqual((await db.query('select config,content from profile_content_blocks where id=$1',[copy])).rows[0],(await db.query('select config,content from profile_content_blocks where id=$1',[block])).rows[0]);
 assert.equal((await db.query('select asset_id from profile_video_uses where block_id=$1',[copy])).rows[0].asset_id,a);
 await db.query('delete from profile_video_uses where block_id=$1',[block]);assert.equal((await db.query('select asset_id from profile_video_uses where block_id=$1',[copy])).rows[0].asset_id,a);
 assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='company-profile-videos'")).rows[0].n,1);
});

test('video identity rejects another company, image targets and oversized/mislabeled originals',async()=>{
 await actor(admin);const a=(await db.query('select media_library_register_video($1,$2,$3,$4) id',[profile,path,'Film','a'.repeat(64)])).rows[0].id;
 await denied('select media_library_use_video($1,$2)',[owner,a]);
 await denied("insert into profile_video_uses(profile_id,block_id,asset_id,storage_path) values($1,$2,$3,$4)",[profile,owner,a,path]);
 for(const metadata of [{size:52428801,mimetype:'video/mp4'},{size:100,mimetype:'image/png'}]) {
  await db.exec('reset role');await db.query('update storage.objects set metadata=$1 where name=$2',[metadata,path]);await actor(admin);
  await denied('select media_library_use_video($1,$2)',[profile,a]);
 }
});
test('seed adds 15 catalog-only Joomla URLs, no header/block usage or publication',async()=>{
 assert.equal((await db.query("select count(*)::int n from media_library_assets where bucket_id='external-video'")).rows[0].n,15);
 assert.equal((await db.query('select count(*)::int n from profile_video_uses')).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from company_profiles where status<>'draft' or video_path is not null")).rows[0].n,0);
});

test('public approved video use is readable; foreign writes and broad deletes remain blocked',async()=>{
 const block='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';await actor(admin);
 const a=(await db.query('select media_library_register_video($1,$2,$3,$4) id',[profile,path,'Film','a'.repeat(64)])).rows[0].id;
 await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values($1,$2,'video',$3,$4)",[block,profile,{text:''},{width_percent:100,offset_percent:0,text_align:'left',spacing_top:'normal',spacing_bottom:'normal'}]);await db.query('select media_library_use_video($1,$2,$3)',[profile,a,block]);
 await db.exec('reset role');await db.query("insert into company_profile_categories(profile_id,category_id) values($1,'heizung')",[profile]);await db.query("update company_profiles set status='approved' where id=$1",[profile]);
 await db.exec("create policy qa_broad_video_delete on storage.objects for delete to authenticated using(bucket_id='company-profile-videos')");
 await actor('','anon');assert.equal((await db.query('select storage_path from profile_video_uses where block_id=$1',[block])).rows[0].storage_path,path);assert.equal((await db.query('select name from storage.objects where name=$1',[path])).rows.length,1);await denied('delete from profile_video_uses where block_id=$1',[block]);
 await actor('99999999-9999-4999-8999-999999999999');assert.equal((await db.query('delete from profile_video_uses where block_id=$1 returning id',[block])).rows.length,0);await denied('select media_library_use_video($1,$2,$3)',[profile,a,block]);
 await actor(admin);assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
 await db.query('delete from profile_video_uses where block_id=$1',[block]);assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0,'unlinked catalog original is retained too');
});

test('catalog pages include all company originals once, bounded to 24, preserve usage and search, exclude missing files',async()=>{
 await db.exec('reset role');
 for(let n=0;n<30;n++){
 const id='aaaaaaaa-aaaa-4aaa-9aaa-'+String(n).padStart(12,'0'),p='profiles/'+profile+'/gallery/'+id+'.jpg';
 await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)",[p]);
 await db.query("insert into media_library_assets(id,profile_id,bucket_id,storage_path,kind,name) values($1,$2,'company-media',$3,'gallery',$4)",[id,profile,p,'Original '+String(n).padStart(2,'0')]);
 await db.query("insert into media_library_files(asset_id,bucket_id,storage_path,profile_id,context_key) values($1,'company-media',$2,$3,'original')",[id,p,profile]);
 }
 await actor(admin);
 const pages=[];for(const page of [1,2])pages.push((await db.query("select media_library_page($1,'images','Original',$2,false) p",[profile,page])).rows[0].p);
 assert.equal(pages[0].count,30);assert.equal(pages[0].items.length,24);assert.equal(pages[1].items.length,6);
 assert.equal(new Set(pages.flatMap(p=>p.items.map(i=>i.id))).size,30);
 assert.ok(pages.flatMap(p=>p.items).every(i=>i.preview_file?.bucket==='company-media'&&Array.isArray(i.usages)));
 assert.equal((await db.query("select media_library_page($1,'images','Original 29',1,false) p",[profile])).rows[0].p.count,1);
});
