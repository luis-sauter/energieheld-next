import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import './helpers/load-ts.mjs';
const mocks = {
  'server-only': '',
  './supabase/server': 'export async function createClient(){return globalThis.inlineLifecycleClient}',
  './admin-review': 'export async function checkAdmin(){return globalThis.inlineLifecycleAdmin?"admin":"forbidden"}',
  './ad-campaigns': 'export async function signAdImages(client,rows){globalThis.inlineLifecycleSigned=rows.map(r=>r.id);return rows}',
  '../app/(energieheld)/inline-banner-actions': 'export const prepareInlineBanner=()=>{},saveInlineBanner=()=>{},removeInlineBanner=()=>{},reorderInlineBanners=()=>{},saveInlineBannerMetadata=()=>{},saveInlineBannerCrop=()=>{};',
  './banner-presentation-loader': 'export async function loadBannerPresentations(){return {rows:[],error:null}}',
  './banner-search-metadata': 'export async function loadBannerMetadata(){return {values:new Map(),terms:[]}};export const legacyBannerKey=v=>v;',
};
registerHooks({resolve(s,c,next){if(c.parentURL?.endsWith('/inline-advertising-loader.ts')&&Object.hasOwn(mocks,s))return {shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(mocks[s])};return next(s,c);}});
const {loadInlineBannerOptions}=await import('../src/lib/inline-advertising-loader.ts');
const target={target_type:'portal_area',target_key:'reiseziele/schweiz',category_id:null,placement:'sidebar_12'};
function row(id,status,archived_at=null){return {id,status,archived_at,is_editorial:true,targets:[target],headline:id,target_url:'https://example.org/',approved_start_date:'2000-01-01',approved_end_date:'9999-12-31'};}
function setup(rows){globalThis.inlineLifecycleAdmin=true;globalThis.inlineLifecycleSigned=[];globalThis.inlineLifecycleClient={from(){return {select(){return this},order:async()=>({data:rows,error:null})}},rpc:async()=>({data:[],error:null})};}
test('archived approved and pending banners do not occupy inline slots after reload or receive media URLs',async()=>{
 setup([row('archived-approved','approved','2026-10-06'),row('archived-pending','pending','2026-10-06')]);
 const options=await loadInlineBannerOptions('/reiseziele/schweiz');assert.ok(options);assert.equal(options.error,undefined);assert.deepEqual(options.banners.filter(b=>b.source==='campaign'),[]);assert.equal(options.availability.sidebar_12,undefined);assert.deepEqual(globalThis.inlineLifecycleSigned,[]);assert.ok(options.banners.some(b=>b.source==='legacy'),'historic fallback remains available');
});
test('current approved and editable draft banners retain the existing inline behavior; non-admin gets no controls',async()=>{
 setup([row('active','approved'),row('draft','draft'),row('archived','approved','2026-10-06')]);
 const options=await loadInlineBannerOptions('/reiseziele/schweiz');assert.deepEqual(options.banners.filter(b=>b.source==='campaign').map(b=>b.id),['active','draft']);assert.deepEqual(globalThis.inlineLifecycleSigned,['active','draft']);
 globalThis.inlineLifecycleAdmin=false;assert.equal(await loadInlineBannerOptions('/reiseziele/schweiz'),undefined);
});
