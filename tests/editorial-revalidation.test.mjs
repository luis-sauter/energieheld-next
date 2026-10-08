import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import './helpers/load-ts.mjs';
const result={success:'Saved',access:'admin'};const calls=[];
registerHooks({resolve(s,c,next){
 if(s==='next/cache')return {url:'data:text/javascript,export function revalidatePath(...a){globalThis.auditRevalidations.push(a)}',shortCircuit:true};
 if(s==='next/navigation')return {url:'data:text/javascript,export function redirect(){throw Error("redirect")}',shortCircuit:true};
 if(s==='@/lib/supabase/server')return {url:'data:text/javascript,export async function createClient(){return {}}',shortCircuit:true};
 if(s==='@/lib/admin')return {url:'data:text/javascript,export function requireAdminAccess(access){if(access!=="admin")throw Error("denied")}',shortCircuit:true};
 if(s==='@/lib/ad-campaigns')return {url:'data:text/javascript,export async function decideAd(){return globalThis.auditDecision};export async function saveOwnAd(){};export async function prepareAdUpload(){};export async function loadAdAvailability(){}',shortCircuit:true};
 if(s==='@/lib/company-quality')return {url:'data:text/javascript,export async function changeQualityReview(){return globalThis.auditDecision}',shortCircuit:true};
 if(s==='@/lib/admin-review')return {url:'data:text/javascript,export async function checkAdmin(){return "admin"};export function isProfileId(){return true}',shortCircuit:true};
 if(s==='@/lib/banner-search-metadata')return {url:'data:text/javascript,export function validateBannerMetadata(){};export function saveBannerMetadata(){};export function onlyBannerMetadataChanged(){}',shortCircuit:true};
 if(s==='@/lib/ad-lifecycle')return {url:'data:text/javascript,export async function changeAdLifecycle(){}',shortCircuit:true};
 return next(s,c);
}});
const {reviewCampaign}=await import('../src/app/(energieheld)/admin/werbung/actions.ts');
const {saveQualityReview}=await import('../src/app/(energieheld)/admin/quality-actions.ts');
test('successful advertising and verification decisions invalidate shared layout task badge; failures do not',async()=>{
 for(const action of [reviewCampaign,saveQualityReview]){
  globalThis.auditRevalidations=calls;globalThis.auditDecision=result;calls.length=0;
  await action({},new FormData());assert.ok(calls.some(([path,type])=>path==='/'&&type==='layout'));
  globalThis.auditDecision={error:'Conflict',access:'admin'};calls.length=0;await action({},new FormData());assert.equal(calls.length,0);
  globalThis.auditDecision={access:'forbidden'};await assert.rejects(action({},new FormData()));assert.equal(calls.length,0);
 }
});
