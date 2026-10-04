import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMediaTestDatabase } from './helpers/media-database.mjs';
const owner = '11111111-1111-4111-8111-111111111111', foreign = '22222222-2222-4222-8222-222222222222', admin = '33333333-3333-4333-8333-333333333333';
const profile = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', company = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const path = `profiles/${profile}/video/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4`;
test('profile video RLS, object reference, size and unchanged image protections', async () => {
  const db = await createMediaTestDatabase(true);
  try {
    await db.exec(`alter table storage.objects add column metadata jsonb;
      create policy profiles_admin_update on company_profiles for update to authenticated using (exists(select 1 from portal_admins where user_id=auth.uid()));
      insert into companies values ('${company}','${owner}','Company');
      insert into company_profiles(id,company_id,display_name,status) values ('${profile}','${company}','Profile','draft');
      insert into company_profile_categories(profile_id,category_id) values ('${profile}','heizung');
      update company_profiles set status='approved' where id='${profile}';
      insert into portal_admins values ('${admin}');`);
    const before = await db.query("select * from storage.buckets order by id");
    await db.exec(await readFile(new URL('../supabase/migrations/20261004100000_company_profile_video.sql',import.meta.url),'utf8'));
    const policiesBefore=(await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows;
    await db.exec(await readFile(new URL('../supabase/migrations/20261004130000_profile_video_100_mib.sql',import.meta.url),'utf8'));
    assert.deepEqual((await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows,policiesBefore);
    const bucket=(await db.query("select * from storage.buckets where id='company-profile-videos'")).rows[0];
    assert.equal(Number(bucket.file_size_limit),104857600);assert.equal(bucket.public,false);assert.deepEqual(bucket.allowed_mime_types,['video/mp4','video/webm']);
    assert.deepEqual((await db.query("select * from storage.buckets where id='company-media'")).rows,before.rows);
    for (const role of ['anon','authenticated']) {
      const rights = (await db.query(`select has_column_privilege('${role}','company_profiles','video_path','SELECT') as read, has_column_privilege('${role}','company_profiles','video_path','UPDATE') as write`)).rows[0];
      assert.equal(rights.read,true); assert.equal(rights.write,role==='authenticated');
    }
    const as = async (uid, sql) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`); try { return await db.query(sql); } finally { await db.exec('reset role'); } };
    await assert.rejects(as(foreign,`insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos','${path}','{"size":100,"mimetype":"video/mp4"}')`),/row-level security/);
    await as(owner,`insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos','${path}','{"size":100,"mimetype":"video/mp4"}')`);
    await db.exec("select set_config('request.jwt.claim.sub','',false); set role anon;");
    assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='company-profile-videos'")).rows[0].n,0);
    await assert.rejects(db.query(`update company_profiles set video_path='${path}' where id='${profile}'`),/permission denied/);
    await db.exec('reset role');
    assert.equal((await as(foreign,`update company_profiles set video_path='${path}' where id='${profile}' returning id`)).rows.length,0);
    await as(owner,`update company_profiles set video_path='${path}' where id='${profile}'`);
    assert.equal((await db.query(`select status from company_profiles where id='${profile}'`)).rows[0].status,'approved');
    assert.equal((await as(owner,`delete from storage.objects where name='${path}' returning id`)).rows.length,0);
    assert.equal((await as(owner,`update storage.objects set name=name where name='${path}' returning id`)).rows.length,0);
    await db.exec("select set_config('request.jwt.claim.sub','',false); set role anon;");
    assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='company-profile-videos'")).rows[0].n,1);
    await db.exec('reset role');
    await as(admin,`update company_profiles set video_path=null where id='${profile}'`);
    await as(owner,`delete from storage.objects where name='${path}'`);
    for(const size of [26214401,104857600]) {
      await as(owner,`insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos','${path}','{"size":${size},"mimetype":"video/mp4"}')`);
      await as(owner,`update company_profiles set video_path='${path}' where id='${profile}'`);
      await as(owner,`update company_profiles set video_path=null where id='${profile}'`);
      await as(owner,`delete from storage.objects where name='${path}'`);
    }
    for (const metadata of ['{"size":104857601,"mimetype":"video/mp4"}','{"size":100,"mimetype":"image/png"}']) {
      await db.exec(`insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos','${path}','${metadata}')`);
      await assert.rejects(as(admin,`update company_profiles set video_path='${path}' where id='${profile}'`),/invalid profile video/);
      await db.exec(`delete from storage.objects where name='${path}'`);
    }
    await assert.rejects(as(admin,`update company_profiles set video_path='profiles/dddddddd-dddd-4ddd-8ddd-dddddddddddd/video/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp4' where id='${profile}'`),/invalid profile video/);
    await as(admin,`insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos','${path}','{"size":100,"mimetype":"video/mp4"}')`);
    await db.exec(`update company_profiles set status='draft' where id='${profile}'`);
    await as(owner,`update company_profiles set video_path='${path}' where id='${profile}'`);
    await db.exec("select set_config('request.jwt.claim.sub','',false); set role anon");
    assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='company-profile-videos'")).rows[0].n,0);
    await db.exec('reset role');
    assert.equal((await db.query("select count(*)::int n from pg_policies where schemaname='storage' and policyname like 'profile_video%'")).rows[0].n,3);
  } finally { await db.close(); }
});
