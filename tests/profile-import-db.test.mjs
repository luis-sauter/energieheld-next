import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration = await readFile(new URL('../supabase/migrations/20261010200813_company_profile_import_provenance.sql', import.meta.url),'utf8');
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', owner='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', profile='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
test('import provenance is admin-only and leaves existing profiles untouched', async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE public.portal_admins(user_id uuid PRIMARY KEY); GRANT SELECT ON public.portal_admins TO authenticated;
 CREATE TABLE public.company_profiles(id uuid PRIMARY KEY,status text); INSERT INTO public.company_profiles VALUES ('${profile}','draft');
 INSERT INTO public.portal_admins VALUES ('${admin}'); GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;`);
 await db.exec(migration);
 const actor=async(id,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE '+role);};
 await actor(admin);
 await db.query('INSERT INTO company_profile_imports(profile_id,source_url,review_note) VALUES ($1,$2,$3)',[profile,'https://hotel.example/','Rights review pending']);
 assert.equal((await db.query('SELECT * FROM company_profile_imports')).rows.length,1);
 await db.query('UPDATE company_profile_imports SET review_note=$1 WHERE profile_id=$2',['Credit verified',profile]);
 await assert.rejects(db.query('UPDATE company_profile_imports SET source_url=$1',['javascript:alert(1)']));
 await assert.rejects(db.query('UPDATE company_profile_imports SET review_note=$1',['x'.repeat(4001)]));
 await assert.rejects(db.query('DELETE FROM company_profile_imports'));
 await actor(owner); assert.equal((await db.query('SELECT * FROM company_profile_imports')).rows.length,0);
 assert.equal((await db.query('UPDATE company_profile_imports SET review_note=$1 RETURNING profile_id',['bad'])).rows.length,0);
 await assert.rejects(db.query('INSERT INTO company_profile_imports(profile_id,source_url) VALUES ($1,$2)',[profile,'https://evil.example/']));
 await actor('', 'anon'); await assert.rejects(db.query('SELECT * FROM company_profile_imports'));
 await assert.rejects(db.query('INSERT INTO company_profile_imports(profile_id,source_url) VALUES ($1,$2)',[profile,'https://evil.example/']));
 await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT status FROM company_profiles')).rows[0].status,'draft');
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE proname LIKE '%import%' AND prosecdef")).rows[0].n,0);
 } finally {await db.close();}
});
