import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    const mocks = {
      'next/server': 'export const NextResponse={next:()=>globalThis.__proxyTest.next()}',
      '@supabase/ssr': 'export function createServerClient(...args){return globalThis.__proxyTest.create(...args)}',
      './env': 'export function getSupabaseEnv(){return {url:"https://project.supabase.co",publishableKey:"public-test-key"}}',
    };
    return mocks[specifier] ? {url:'data:text/javascript,'+encodeURIComponent(mocks[specifier]),shortCircuit:true} : next(specifier,context);
  },
  load(url, context, next) {
    return url.endsWith('/supabase/proxy.ts') ? {format:'module',shortCircuit:true,
      source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext}}).outputText} : next(url,context);
  },
});
const {updateSession}=await import('../src/lib/supabase/proxy.ts');
function setup(names=[],refresh=false) {
  const calls=[];
  const request={cookies:{values:names.map(name=>({name,value:'existing'})),getAll(){return this.values},set(name,value){this.values=this.values.filter(c=>c.name!==name);this.values.push({name,value})}}};
  const state={calls,next(){const values=[];return {headers:new Headers(),cookies:{getAll:()=>values,set(cookie,value,options){values.push(typeof cookie==='string'?{name:cookie,value,...options}:cookie)}}}},create(url,key,options){calls.push('create');assert.equal(url,'https://project.supabase.co');assert.equal(key,'public-test-key');return {auth:{async getClaims(){calls.push('claims');if(refresh){options.cookies.setAll([{name:'sb-project-auth-token.0',value:'renewed',options:{httpOnly:true}}],{'cache-control':'private, no-store','pragma':'no-cache'});options.cookies.setAll([{name:'sb-project-auth-token.1',value:'second',options:{httpOnly:true}}],{'expires':'0'});}}}}}};
  globalThis.__proxyTest=state;
  return {request,calls};
}
test('anonymous and unrelated cookies never create an auth client',async()=>{
  for(const names of [[],['consent'],['sb-other-auth-token'],['sb-project-auth-token-code-verifier']]){
    const {request,calls}=setup(names);await updateSession(request);assert.deepEqual(calls,[]);
  }
});
test('whole, expired-looking and chunked session cookies retain claims verification',async()=>{
  for(const names of [['sb-project-auth-token'],['sb-project-auth-token.0'],['sb-project-auth-token.1','sb-project-auth-token.0']]){
    const {request,calls}=setup(names);await updateSession(request);assert.deepEqual(calls,['create','claims']);
  }
});
test('successive refresh writes preserve request/response cookies and no-store headers',async()=>{
  const {request,calls}=setup(['sb-project-auth-token.0'],true);const response=await updateSession(request);
  assert.deepEqual(calls,['create','claims']);assert.equal(request.cookies.getAll().find(c=>c.name.endsWith('.0')).value,'renewed');
  assert.deepEqual(response.cookies.getAll().map(c=>c.value),['renewed','second']);
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('pragma'),'no-cache');assert.equal(response.headers.get('expires'),'0');
});
