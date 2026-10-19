import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
const { reusableBanners } = await import('../src/lib/reusable-banners.ts');
test('inline library retains archived originals next to their live copies and offers curated existing creatives',()=>{
 const old={id:'old',archived_at:'2026-10-19',image_path:'private',headline:'Banner',target_url:'https://example.org'};
 const live={...old,id:'live',archived_at:null,lifecycle_group_id:'old'};
 const result=reusableBanners([old,live,{...old,id:'deleted',deletion_requested_at:'now'},{...old,id:'empty',image_path:null}]);
 assert.ok(result.some(row=>row.id==='old'&&row.archived));assert.ok(result.some(row=>row.id==='live'&&!row.archived));
 assert.ok(!result.some(row=>['deleted','empty'].includes(row.id)));assert.ok(result.some(row=>row.id==='legacy:/:top_banner'));
 assert.ok(result.every(row=>Object.keys(row).sort().join(',')==='archived,id,name'));
});
