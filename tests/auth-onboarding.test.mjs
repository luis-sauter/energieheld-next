import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({
 resolve(s,c,n){
  const mocks={ 'server-only':'export {}', 'next/link':'export default "a"', 'next/headers':'export async function headers(){return new Map([["origin",globalThis.__origin]])}', 'next/navigation':'export function redirect(p){throw Error("REDIRECT:"+p)}', 'next/server':'export const NextResponse={redirect:url=>({url:url.href,headers:new Map()})}' };
  if(s.endsWith('/supabase/server'))return {url:'data:text/javascript,export async function createClient(){return globalThis.__authTestClient}',shortCircuit:true};
  if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(mocks[s])return {url:'data:text/javascript,'+mocks[s],shortCircuit:true};
  if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return n(b.href+ext,c)}return n(s,c);
 },
 load(u,c,n){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return n(u,c)}
});
const {register,login,requestPasswordReset,resetPassword}=await import('../src/app/(energieheld)/auth-actions.ts');
const {authCallbackOrigin,authRedirectUrl,hasRecentRecovery,recoveryRequestMessage,validateNewPassword}=await import('../src/lib/auth-recovery.ts');
const {GET:confirm}=await import('../src/app/auth/confirm/route.ts');
const {GET:recovery}=await import('../src/app/auth/recovery/route.ts');
const {CompanyOnboarding}=await import('../src/components/auth/company-onboarding.tsx');
const {companyPreparation}=await import('../src/lib/company-onboarding.ts');
const {AuthForm}=await import('../src/components/auth/auth-form.tsx');
const {default:ResetPage}=await import('../src/app/(energieheld)/passwort-zuruecksetzen/page.tsx');
const origin='https://feature-portal-frontend--startling-choux-aaa598.netlify.app';
function form(extra={}){const f=new FormData();for(const [k,v] of Object.entries({email:'test@example.test',password:'test-password',password_confirmation:'test-password',full_name:'Test',company_name:'Test',...extra}))f.set(k,v);return f}
function client({method='recovery',error=null,session=null,revoked=false}={}){
 const calls=[];const claims={sub:'verified-user',amr:[{method,timestamp:Math.floor(Date.now()/1000)}]};
 return {calls,auth:{signUp:async v=>{calls.push(['signup',v]);return {data:{session},error}},signInWithPassword:async()=>({error:{code:'email_not_confirmed'}}),resetPasswordForEmail:async(e,v)=>{calls.push(['request',e,v]);return {error}},getClaims:async()=>({data:{claims},error:null}),getUser:async()=>({data:{user:revoked?null:{id:'verified-user'}},error:null}),verifyOtp:async v=>{calls.push(['otp',v]);return {error}},exchangeCodeForSession:async code=>{calls.push(['exchange',code]);return {error}},updateUser:async v=>{calls.push(['update',v]);return {error}},signOut:async v=>{calls.push(['out',v]);return {error:null}}}};
}
function setup(options){globalThis.__origin=origin;return globalThis.__authTestClient=client(options)}
function request(query){const url=new URL('https://feature-portal-frontend--startling-choux-aaa598.netlify.app/auth/callback'+query);return {url:url.href,nextUrl:url,headers:new Headers({host:url.host})}}
test('signup sends exact safe confirmation redirect; no session yields confirmation state without immediate login claim',async()=>{
 const c=setup();const state=await register({},form());assert.equal(state.confirmationEmail,'test@example.test');assert.match(state.success,/Bestätigungslink/);assert.doesNotMatch(state.success,/jetzt anmelden/);assert.equal(c.calls[0][1].options.emailRedirectTo,origin+'/auth/confirm');
 setup({session:{}});assert.ok((await register({},form())).error);assert.deepEqual(globalThis.__authTestClient.calls.at(-1),['out',{scope:'local'}]);
 setup();assert.match((await login({},form())).error,/zuerst Ihre E-Mail/);
});
test('safe redirects reject external origins, userinfo, query, path, non-https and forged next values',()=>{
 for(const bad of [null,'https://evil.example','https://das-reiseportal.com@evil.example','https://das-reiseportal.com/a','https://das-reiseportal.com?next=evil','https://startling-choux-aaa598.netlify.app.evil.example'])assert.throws(()=>authRedirectUrl(bad,'/auth/recovery'));
 assert.equal(authRedirectUrl(origin,'/auth/recovery'),origin+'/auth/recovery');
 const immutable='https://6ac665b07f92140008b4a8f8--startling-choux-aaa598.netlify.app';
 assert.equal(authCallbackOrigin({url:origin+'/auth/recovery',headers:new Headers({host:new URL(immutable).host})}),immutable);
 assert.equal(authCallbackOrigin({url:origin+'/auth/recovery',headers:new Headers({host:'evil.example'})}),origin);
});
test('reset requests validate email, use safe callback and hide account/provider errors including rate limit',async()=>{
 for(const error of [null,{code:'user_not_found'},{code:'over_email_send_rate_limit'}]){const c=setup({error});assert.deepEqual(await requestPasswordReset({},form()),{success:recoveryRequestMessage});assert.equal(c.calls[0][2].redirectTo,origin+'/auth/recovery')}
 const c=setup();assert.ok((await requestPasswordReset({},form({email:'invalid'}))).error);assert.equal(c.calls.length,0);
 c.auth.resetPasswordForEmail=async()=>{throw Error('private info')};assert.deepEqual(await requestPasswordReset({},form()),{success:recoveryRequestMessage});
});
test('confirmation accepts signup/email only; expiry errors clear tokens and next is ignored',async()=>{
 for(const type of ['signup','email']){setup();const response=await confirm(request('?token_hash=proof&type='+type+'&next=//evil.example'));assert.equal(response.url,origin+'/firma?willkommen=1');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer')}
 for(const query of ['','?token_hash=proof&type=recovery','?token_hash=proof&type=email_change']){const c=setup();assert.equal((await confirm(request(query))).url,origin+'/login?error=confirmation');assert.equal(c.calls.length,0)}
 setup({error:{}});assert.equal((await confirm(request('?token_hash=proof&type=signup'))).url,origin+'/login?error=confirmation');
 setup({method:'email/signup'});assert.equal((await confirm(request('?code=pkce'))).url,origin+'/firma?willkommen=1');setup({method:'recovery'});assert.match((await confirm(request('?code=pkce'))).url,/error=confirmation/);
});
test('recovery accepts legitimate OTP or PKCE with verified recovery proof, never normal login/signup',async()=>{
 for(const query of ['?token_hash=proof&type=recovery','?code=pkce&next=//evil.example']){setup();assert.equal((await recovery(request(query))).url,origin+'/passwort-zuruecksetzen')}
 for(const query of ['','?token_hash=proof&type=signup','?token_hash=proof&type=email','?code=pkce&type=signup']){const c=setup();assert.match((await recovery(request(query))).url,/error=recovery/);assert.equal(c.calls.length,0)}
 for(const method of ['password','email/signup','otp']){setup({method});assert.match((await recovery(request('?code=pkce'))).url,/error=recovery/)}
 setup({error:{}});assert.match((await recovery(request('?token_hash=proof&type=recovery'))).url,/error=recovery/);
});
test('recovery proof must be recent, verified user must match; normal or revoked sessions cannot mutate passwords',async()=>{
 assert.equal(hasRecentRecovery({sub:'x',amr:[{method:'recovery',timestamp:1}]}),false);assert.equal(hasRecentRecovery({sub:'x',amr:['recovery']}),false);
 for(const opts of [{method:'password'},{method:'email/signup'},{revoked:true}]){const c=setup(opts);assert.ok((await resetPassword({},form())).error);assert.equal(c.calls.some(v=>v[0]==='update'),false);await assert.rejects(ResetPage(),/REDIRECT:.*error=recovery/)}
 setup();assert.equal(validateNewPassword(form({password:'short'})).password,undefined);assert.ok((await resetPassword({},form({password_confirmation:'different'}))).error);
 const c=setup();await assert.rejects(resetPassword({},form()),/REDIRECT:\/login\?passwort=geaendert/);assert.deepEqual(c.calls,[['update',{password:'test-password'}],['out',{scope:'local'}]]);
});
test('login exposes forgotten password; onboarding steps are ordered and real-field completeness does not mistake autogenerated name for progress',()=>{
 assert.match(renderToStaticMarkup(createElement(AuthForm,{mode:'login'})),/href="\/passwort-vergessen"/);
 const p={status:'draft',display_name:'Autogenerated'};assert.equal(companyPreparation(p).next,0);assert.equal(companyPreparation(p).completed,0);
 const prepared={...p,description:'A real description',phone:'123',city:'Berlin',postal_code:'10115'};assert.equal(companyPreparation(prepared).next,1);assert.equal(companyPreparation({...prepared,company_profile_images:[{id:1}]}).next,2);
 const html=renderToStaticMarkup(createElement(CompanyOnboarding,{profile:p}));assert.ok(html.indexOf('Angaben zu Ihrer Unterkunft')<html.indexOf('Profil gestalten'));assert.match(html,/aria-current="step"/);assert.match(html,/#freischaltung/);assert.match(html,/noch nicht öffentlich/);
 for(const [status,expected] of [['pending','redaktionelle Prüfung'],['rejected','Profil überarbeiten'],['approved','Öffentliches Profil ansehen']])assert.match(renderToStaticMarkup(createElement(CompanyOnboarding,{profile:{...p,status,slug:'actual-profile'}})),new RegExp(expected));
});
