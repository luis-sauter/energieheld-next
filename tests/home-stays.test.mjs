import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
const { selectHomeStays } = await import('../src/lib/home-stays.ts');
const { autumnSelections } = await import('../src/lib/autumn-showcase.ts');
const { SPECIAL_TOPIC_TERM } = await import('../src/lib/travel-editorial.ts');
const row = (id, overrides = {}) => ({ id, slug: 'real-'+id, name: 'Unterkunft '+id,
  location: { city: 'Ort', country: ['Deutschland','Österreich','Schweiz','Italien'][Number(id)%4] ?? 'Deutschland' },
  isDemo: false, images: [{id:'photo-'+id,src:'/real-'+id+'.jpg',alt:'Betreiberfoto'}], ...overrides });

test('public input is sampled once, diverse, unique and immutable, with deterministic hydration order', () => {
  const rows = Array.from({length:30},(_,i)=>row(String(i))), original = structuredClone(rows);
  const selected=selectHomeStays([...rows,rows[0]],'visit-one');
  assert.equal(selected.length,12); assert.equal(new Set(selected.map(p=>p.id)).size,12);
  assert.equal(new Set(selected.map(p=>p.location.country)).size,4);
  assert.deepEqual(selected,selectHomeStays(rows,'visit-one'));
  assert.notDeepEqual(selected,selectHomeStays(rows,'visit-two'));
  assert.deepEqual(rows,original); assert.ok(selected.every(p=>rows.includes(p)));
});
test('demo, preview, missing photos, logo-only and incomplete cards never enter the row', () => {
  const excluded=[row('demo',{isDemo:true}),row('preview',{isPreview:true}),row('empty',{images:[]}),
    row('logo',{logo:{src:'/logo.jpg'},images:[{src:'/logo.jpg'}]}),row('null',{travelImage:null}),
    row('name',{name:' '}),row('city',{location:{city:'',country:'Deutschland'}})];
  assert.deepEqual(selectHomeStays([...excluded,row('1')],'visit'),[row('1')]);
  assert.deepEqual(selectHomeStays([],'visit'),[]);
});
test('actually rendered autumn highlights are excluded, but a small real directory remains usable', () => {
  const highlights=autumnSelections.map(s=>row(s.profileId,{travelTermKeys:[SPECIAL_TOPIC_TERM],images:[{id:s.imageId,src:'/real.jpg'}]}));
  const additional=Array.from({length:8},(_,i)=>row(String(i)));
  assert.deepEqual(new Set(selectHomeStays([...highlights,...additional],'visit').map(p=>p.id)),new Set(additional.map(p=>p.id)));
  assert.equal(selectHomeStays(highlights,'visit').length,4);
  const absent=highlights.map(p=>({...p,travelTermKeys:[]}));
  assert.equal(selectHomeStays(absent,'visit').length,4);
});
test('reviewed existing card photos take priority without overriding images, crop or gallery', () => {
  const assets=['d8567002-150a-46fb-acd1-242b7eba8c55','d18139ff-71fd-4bee-8817-29427191f43b',
    '1f633238-149d-4748-8f8d-4008e3ffa83b','6377d190-91cd-4748-acfb-33694bd712b1',
    '79b31d1a-a9ba-4314-ae29-5cc23c66e180','202fa047-9ac7-4526-8c35-d6b5f0d6bbad'];
  const reviewed=assets.map((asset,i)=>row(String(i),{cardImageAssetId:asset,cardImageCrop:{zoom:1.2,focusX:45,focusY:60}}));
  const selected=selectHomeStays([...reviewed,row('unknown')],'visit');
  assert.equal(selected.length,6);assert.ok(selected.every(p=>reviewed.includes(p)));
  assert.equal(selectHomeStays([row('id-match',{images:[{id:assets[0],src:'/real.jpg'}]})],'visit').length,1);
});
