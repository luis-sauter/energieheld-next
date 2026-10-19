import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('map RPC exposes only current public IDs/addresses, uses bounded keysets and grants no table access', async () => {
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE TABLE public.basic_accommodation_contacts(id uuid PRIMARY KEY,address jsonb,is_listed boolean,rights_valid_until timestamptz);
   ALTER TABLE public.basic_accommodation_contacts ENABLE ROW LEVEL SECURITY;
   INSERT INTO public.basic_accommodation_contacts SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'{"city":"Public town"}',true,null FROM generate_series(1,1005)i;
   INSERT INTO public.basic_accommodation_contacts VALUES('10000000-0000-0000-0000-000000000000','{"city":"Private"}',false,null),('20000000-0000-0000-0000-000000000000','{"city":"Expired"}',true,now()-interval '1 day');`);
  const sql=readFileSync(new URL('../supabase/migrations/20261019144149_public_basic_map_contacts.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/acquisition\./);
  await db.exec(sql);
  const before=await db.query('SELECT md5(string_agg(t::text,\'\' ORDER BY id)) hash FROM public.basic_accommodation_contacts t');
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   const first=(await db.query('SELECT * FROM public.public_basic_map_contacts()')).rows;
   assert.equal(first.length,1000);assert.deepEqual(Object.keys(first[0]).sort(),['address','id']);
   const second=(await db.query('SELECT * FROM public.public_basic_map_contacts($1,1000)',[first.at(-1).id])).rows;
   assert.equal(second.length,5);assert.equal(new Set([...first,...second].map(r=>r.id)).size,1005);
   assert.ok([...first,...second].every(r=>r.address.city==='Public town'));
   for(const size of [0,-1,1001,null])await assert.rejects(db.query('SELECT * FROM public.public_basic_map_contacts(null,$1)',[size]),/invalid map page size/);
   await assert.rejects(db.query('SELECT * FROM public.basic_accommodation_contacts'),/permission denied/);
   await db.exec('RESET ROLE');
  }
  const after=await db.query('SELECT md5(string_agg(t::text,\'\' ORDER BY id)) hash FROM public.basic_accommodation_contacts t');
  assert.deepEqual(before.rows,after.rows);
 } finally { await db.close(); }
});
