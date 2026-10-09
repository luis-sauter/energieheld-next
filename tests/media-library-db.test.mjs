import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMediaTestDatabase} from './helpers/media-database.mjs';
const admin='33333333-3333-4333-8333-333333333333',owner='11111111-1111-4111-8111-111111111111',foreign='44444444-4444-4444-8444-444444444444',profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const path='profiles/'+profile+'/gallery/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png';
let db,asset;
before(async()=>{
 db=await createMediaTestDatabase(true);
 await db.exec("create table profile_content_blocks(id uuid primary key,profile_id uuid,type text);create table profile_content_block_images(id uuid primary key default gen_random_uuid(),block_id uuid,storage_path text,alt_text text,sort_order integer default 0);create table company_ad_campaigns(id uuid primary key,profile_id uuid,image_path text);alter table company_profiles add contact_image_path text;");
 await db.query('insert into portal_admins values ($1)',[admin]);await db.query("insert into companies values ($1,$1,'Firma')",[owner]);await db.query("insert into company_profiles(id,company_id,display_name) values($1,$2,'Firma')",[profile,owner]);
 await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)",[path]);
 await db.exec(await readFile(new URL('../supabase/migrations/20260924155258_admin_company_media_editor.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../supabase/migrations/20261009153723_central_media_library.sql',import.meta.url),'utf8');
 await db.exec(migration);asset=(await db.query('select id from media_library_assets')).rows[0].id;
});
after(async()=>db?.close());beforeEach(async()=>db.exec('begin'));afterEach(async()=>db.exec('rollback'));
async function actor(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role '+role);}
async function denied(sql,args=[]){await db.exec('savepoint deny');await assert.rejects(db.query(sql,args));await db.exec('rollback to savepoint deny;release savepoint deny');}
test('existing unreferenced original backfilled once without altering Storage or profiles',async()=>{
 assert.equal((await db.query('select count(*)::int n from media_library_assets')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 assert.equal((await db.query('select status from company_profiles')).rows[0].status,'draft');
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal")).rows[0].n,0);
});
test('admin catalog, context search, unused filter and pagination; owner/foreign/anon denied',async()=>{
 await actor(admin);let page=(await db.query("select media_library_page($1,'','Firma',1,false) result",[profile])).rows[0].result;assert.equal(page.count,1);assert.equal(page.items[0].id,asset);
 assert.equal((await db.query("select media_library_page(null,'unused','',2,false) result")).rows[0].result.items.length,0);
 for(const id of [owner,foreign]){await actor(id);assert.equal((await db.query('select * from media_library_assets')).rows.length,0);await denied('select media_library_page()');assert.equal((await db.query("update media_library_assets set name='wrong' where id=$1 returning id",[asset])).rows.length,0);}
 await actor('', 'anon');await denied('select * from media_library_assets');await denied('select media_library_page()');
});
test('catalog has no gallery limit; gallery still rejects ninth image',async()=>{
 await actor(owner);
 for(let i=0;i<8;i++)await db.query('insert into company_profile_images(profile_id,storage_path,sort_order) values($1,$2,$3)',[profile,'profiles/'+profile+'/gallery/'+String(i).padStart(36,'0')+'.png',i]);
 await denied('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,path]);
 await db.exec('reset role');for(let i=0;i<30;i++)await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)",['profiles/'+profile+'/gallery/'+String(i).padStart(36,'0')+'.png']);await actor(admin);for(let i=0;i<30;i++)await db.query('select media_library_register_upload($1,$2,$3,$4)',[profile,'profiles/'+profile+'/gallery/'+String(i).padStart(36,'0')+'.png','Bild '+i,'a'.repeat(64)]);
 const p=(await db.query('select media_library_page() result')).rows[0].result;assert.equal(p.count,31);assert.equal(p.items.length,24);
});
test('removing usage preserves original against broad permissive owner delete policy',async()=>{
 await actor(owner);await db.query('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,path]);await db.query('delete from company_profile_images where profile_id=$1',[profile]);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[path])).rows.length,0);
 await actor(admin);assert.equal((await db.query('select media_library_usages($1) refs',[asset])).rows[0].refs.length,0);
 assert.equal((await db.query('select count(*)::int n from storage.objects where name=$1',[path])).rows[0].n,1);
});
test('archive leaves uses intact; only unused archived original can be deletion-locked; reattach fails',async()=>{
 await actor(owner);await db.query('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,path]);
 await actor(admin);await db.query('update media_library_assets set archived_at=now() where id=$1',[asset]);await denied('select media_library_request_delete($1)',[asset]);
 await actor(owner);await db.query('delete from company_profile_images where profile_id=$1',[profile]);
 await actor(admin);const files=(await db.query('select media_library_request_delete($1) files',[asset])).rows[0].files;assert.equal(files[0].path,path);
 await actor(owner);await denied('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,path]);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[path])).rows.length,0);
});
test('metadata edits do not change original, references or crop; shared references are counted',async()=>{
 await actor(owner);await db.query('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,path]);
 await db.exec('reset role');await db.query("insert into profile_content_blocks values($1,$2,'image_grid')",[foreign,profile]);await db.query('insert into profile_content_block_images(block_id,storage_path) values($1,$2)',[foreign,path]);
 await actor(admin);await db.query("update media_library_assets set alt_text='Beschreibung',rights='Freigabe' where id=$1",[asset]);
 assert.equal((await db.query('select media_library_usages($1) refs',[asset])).rows[0].refs.length,2);
 await denied('select media_library_request_delete($1)',[asset]);
 assert.equal((await db.query('select storage_path from media_library_assets where id=$1',[asset])).rows[0].storage_path,path);
});

test('upload registration is atomic and admin-only; duplicate object does not create duplicate asset',async()=>{
 await actor(owner);await denied('select media_library_register_upload($1,$2,$3,$4)',[profile,path,'Upload','a'.repeat(64)]);
 await actor(admin);await denied('select media_library_register_upload($1,$2,$3,$4)',[foreign,path,'Wrong profile','a'.repeat(64)]);
 await denied('select media_library_register_upload($1,$2,$3,$4)',[profile,path,'Duplicate','a'.repeat(64)]);
 assert.equal((await db.query('select count(*)::int n from media_library_assets')).rows[0].n,1);
});
test('post-migration orphan scan captures existing object without gallery usage',async()=>{
 await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)",[path.replace('bbbbbbbb','dddddddd')]);
 await actor(admin);assert.equal((await db.query('select media_library_sync() n')).rows[0].n,1);
 assert.equal((await db.query('select media_library_sync() n')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from company_profile_images')).rows[0].n,0);
});
test('retention does not change video/other-bucket or campaign cleanup permissions',async()=>{
 await actor(owner);assert.equal((await db.query("select media_library_retains_file('company-media',$1) retained",[path])).rows[0].retained,true);
 assert.equal((await db.query("select media_library_retains_file('ad-media',$1) retained",[path])).rows[0].retained,false);
 await actor(foreign);assert.equal((await db.query("select media_library_retains_file('company-media',$1) retained",[path])).rows[0].retained,false);
 const policy=(await db.query("select qual from pg_policies where policyname='media_library_original_retention'")).rows[0].qual;assert.match(policy,/bucket_id <> 'company-media'/);
});


test('admin permanent deletion is guarded, retryable after Storage removal and finishes only after all files are gone',async()=>{
 await actor(admin);await db.query('update media_library_assets set archived_at=now() where id=$1',[asset]);
 await db.query('select media_library_request_delete($1)',[asset]);await denied('select media_library_finish_delete($1)',[asset]);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[path])).rows.length,1);
 let p=(await db.query("select media_library_page(null,'','',1,true) result")).rows[0].result;
 assert.equal(p.items.length,1,'missing original remains discoverable for delete retry');
 await db.query('select media_library_request_delete($1)',[asset]);await db.query('select media_library_finish_delete($1)',[asset]);
 p=(await db.query("select media_library_page(null,'','',1,true) result")).rows[0].result;assert.equal(p.count,0);
 await actor(owner);await denied('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,path]);
});

test('cross-profile controlled copy is discoverable in destination context; its live usage protects the whole asset',async()=>{
 const destination='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';const copy='profiles/'+destination+'/gallery/ffffffff-ffff-4fff-8fff-ffffffffffff.png';
 await db.query("insert into company_profiles(id,company_id,display_name) values($1,$2,'Zielunternehmen')",[destination,owner]);
 await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)",[copy]);await actor(admin);
 await db.query("insert into media_library_files values('company-media',$1,$2,$3,$4)",[copy,asset,destination,destination+':gallery']);
 await db.query('insert into company_profile_images(profile_id,storage_path) values($1,$2)',[destination,copy]);
 const p=(await db.query("select media_library_page($1,'','',1,false) result",[destination])).rows[0].result;
 assert.equal(p.count,1);assert.equal(p.items[0].id,asset);assert.equal(p.items[0].usages[0].profileId,destination);
 await db.query('update media_library_assets set archived_at=now() where id=$1',[asset]);await denied('select media_library_request_delete($1)',[asset]);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[copy])).rows.length,0);
});


test('public invoker bridges work without private schema USAGE and expose no new public definer RPC',async()=>{
 assert.equal((await db.query("select has_schema_privilege('authenticated','private','USAGE') allowed")).rows[0].allowed,false);
 await actor(admin);assert.equal((await db.query("select media_library_page() result")).rows[0].result.count,1);
 assert.equal((await db.query("select media_library_sync() n")).rows[0].n,0);
 assert.equal((await db.query("select media_library_retains_file('company-media',$1) yes",[path])).rows[0].yes,true);
 await actor(owner);await denied("select media_library_asset_references('company-media',$1)",[path]);
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'media_library_%' and p.prosecdef")).rows[0].n,0);
});
