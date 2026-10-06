import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
import { selectableArchivedBanners } from '../src/lib/ad-archive.ts';
const row=(id,group=null,archived='2026-10-06')=>({id,lifecycle_group_id:group,archived_at:archived,headline:'Gleicher Name',target_url:'https://example.org',created_at:'2026-10-05'});
test('three reuse/archive cycles keep at most one selectable logical banner',()=>{
 const rows=[row('original')];assert.equal(selectableArchivedBanners(rows).length,1);
 rows[0].lifecycle_group_id='original';
 for(let cycle=1;cycle<=3;cycle++){
  const copy=row('copy'+cycle,'original',null);rows.push(copy);
  assert.deepEqual(selectableArchivedBanners(rows),[]);
  copy.archived_at='2026-10-0'+(6+cycle);
  assert.deepEqual(selectableArchivedBanners(rows),[{id:copy.id,name:'Gleicher Name'}]);
 }
});
test('same name and URL do not merge standalone banners or different lineages',()=>{
 assert.equal(selectableArchivedBanners([row('a'),row('b'),row('c','group-c'),row('d','group-d')]).length,4);
});
test('current draft or pending version suppresses archives globally; deletion intent excluded',()=>{
 for(const status of ['draft','pending','approved','paused'])assert.deepEqual(selectableArchivedBanners([row('old','g'),{...row('new','g',null),status}]),[]);
 assert.deepEqual(selectableArchivedBanners([{...row('a'),deletion_requested_at:'2026-10-06'}]),[]);
});
