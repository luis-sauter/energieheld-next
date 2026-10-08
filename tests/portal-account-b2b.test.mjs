import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (specifier.endsWith(".module.css")) return { url: "data:text/javascript,export default {}", shortCircuit: true };
    if (specifier === "next/headers") return { url: "data:text/javascript,export async function headers(){return new Map()}", shortCircuit: true };
    if (specifier === "next/navigation") return { url: 'data:text/javascript,export function redirect(path){throw Error("REDIRECT:"+path)}', shortCircuit: true };
    if (specifier.endsWith("/supabase/server")) return { url: 'data:text/javascript,export async function createClient(){return globalThis.__accountClient}', shortCircuit: true };
    if (specifier === "next/link" || specifier === "next/image") return { url: `data:text/javascript,export default ${JSON.stringify(specifier === "next/link" ? "a" : "img")}`, shortCircuit: true };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) return {
      format: "module", shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});


const { loadPortalAccount } = await import('../src/lib/portal-account-loader.ts');
const { accountCta, accountLoginDestination, safeAccountReturnPath } = await import('../src/lib/portal-account.ts');
const { login, logout } = await import('../src/app/(energieheld)/auth-actions.ts');
const { accountMenuGroups, AccountMenu } = await import('../src/components/portal/account-menu.tsx');
const { PortalHeader } = await import('../src/components/portal/chrome.tsx');
const { reiseportal } = await import('../src/config/reiseportal.ts');
const { default: Providers } = await import('../src/app/(energieheld)/fuer-unternehmen/page.tsx');
const { default: Advertising } = await import('../src/app/(energieheld)/werbung/page.tsx');
const { default: Login } = await import('../src/app/(energieheld)/login/page.tsx');
const { default: Register } = await import('../src/app/(energieheld)/registrieren/page.tsx');
const { default: Account } = await import('../src/app/(energieheld)/konto/page.tsx');
function client({ signedIn=true, admin=false, owner=false, error=false }={}) {
 const queries=[];
 return { queries, auth:{getUser:async()=>({data:{user:signedIn?{id:'verified-user',user_metadata:{is_admin:true,company_id:'forged'}}:null},error:null}),signInWithPassword:async()=>({error:null}),signOut:async()=>({error:null})},
 from(table){return {select(){return this},eq(column,value){queries.push([table,column,value]);return this},async maybeSingle(){return {error:error?{}:null,data:table==='companies'?(owner?{id:'own'}:null):(admin?{user_id:'verified-user'}:null)}}}} };
}
const cases=[['guest',{signedIn:false},'unauthenticated',false,'/fuer-unternehmen','/konto'],['owner',{owner:true},'forbidden',true,'/firma','/firma'],['admin without company',{admin:true},'admin',false,'/admin','/admin'],['admin with company',{admin:true,owner:true},'admin',true,'/admin','/admin'],['unassigned',{},'forbidden',false,'/konto','/konto']];
for(const [name,options,access,hasCompany,cta,defaultPath] of cases) test(name+' gets only real server-backed navigation and login destination',async()=>{
 const c=client(options),account=await loadPortalAccount(c);
 assert.equal(account.access,access);assert.equal(account.hasCompany,hasCompany);assert.equal(accountCta(account).href,cta);assert.equal(accountLoginDestination(account),defaultPath);
 const groups=accountMenuGroups(access,hasCompany);
 assert.equal(groups.account.some(x=>x.href==='/firma'),hasCompany);assert.equal(groups.administration.length>0,access==='admin');
 const html=renderToStaticMarkup(createElement(PortalHeader,{brand:reiseportal,access,hasCompany}));assert.ok(html.includes('href="'+cta+'"'));
 if(!options.signedIn&&name==='guest')assert.deepEqual(c.queries,[]);
 else {assert.ok(c.queries.some(q=>q[0]==='companies'&&q[1]==='owner_user_id'&&q[2]==='verified-user'));assert.ok(c.queries.some(q=>q[0]==='portal_admins'&&q[2]==='verified-user'));}
});
test('lookup failures never infer owner/admin from user metadata',async()=>{
 const account=await loadPortalAccount(client({error:true,owner:true,admin:true}));assert.equal(account.access,'forbidden');assert.equal(account.hasCompany,false);
});
test('next allowlist checks real target access and rejects external, malformed or encoded destinations',()=>{
 const owner={access:'forbidden',hasCompany:true},admin={access:'admin',hasCompany:false},both={...admin,hasCompany:true};
 for(const next of ['/firma','/firma/profil','/firma/anfragen','/firma/werbung','/firma/statistiken']){assert.equal(safeAccountReturnPath(next,owner),next);assert.equal(safeAccountReturnPath(next,admin),null);assert.equal(safeAccountReturnPath(next,both),next);}
 for(const next of ['/admin','/admin/werbung']){assert.equal(safeAccountReturnPath(next,owner),null);assert.equal(safeAccountReturnPath(next,admin),next);}
 for(const next of ['https://evil.example','//evil.example','javascript:alert(1)','/\\evil.example','/%2f%2fevil.example','/firma/../admin','/firma?next=//evil.example','/admin/werbung/foreign','/firma/profil/gestalten',' /admin',null,['/admin']])assert.equal(safeAccountReturnPath(next,both),null);
 assert.equal(accountLoginDestination(admin,'/firma/werbung'),'/admin');assert.equal(accountLoginDestination(owner,'/admin'),'/firma');
});
test('real login action honors authorized next and logout retains the existing destination',async()=>{
 for(const [options,next,path] of [[{owner:true},'/firma/werbung','/firma/werbung'],[{admin:true},undefined,'/admin'],[{admin:true},'/firma/werbung','/admin'],[{owner:true},'//evil.example','/firma'],[{},'/firma','/konto']]){
  globalThis.__accountClient=client(options);const data=new FormData();data.set('email','qa@example.test');data.set('password','existing-password');if(next)data.set('next',next);
  await assert.rejects(login({},data),new RegExp('REDIRECT:'+path+'$'));
 }
 await assert.rejects(logout(),/REDIRECT:\/$/);
});
test('B2B pages share accessible layout and honest CTAs; auth preserves required form fields',async()=>{
 globalThis.__accountClient=client({signedIn:false});
 const providers=renderToStaticMarkup(Providers()),ad=renderToStaticMarkup(await Advertising());
 assert.match(providers,/Ihre Unterkunft auf DAS Reiseportal/);assert.match(providers,/href="\/registrieren"/);assert.doesNotMatch(providers,/zukünftiges Profil|Wir gestalten gerade|Ihr Können/);
 assert.match(ad,/href="\/login\?next=\/firma\/werbung"/);assert.match(ad,/Angebotsanfrage stellen/);assert.doesNotMatch(ad,/Werbekampagne planen/);
 const loginHtml=renderToStaticMarkup(await Login({searchParams:Promise.resolve({next:'/firma/werbung'})}));assert.match(loginHtml,/name="next" value="\/firma\/werbung"/);assert.match(loginHtml,/Noch kein Firmenkonto/);
 const registerHtml=renderToStaticMarkup(Register());for(const name of ['full_name','company_name','email','password','password_confirmation'])assert.ok(registerHtml.includes('name="'+name+'"'));assert.match(registerHtml,/Firmenkonto erstellen/);assert.match(registerHtml,/als Entwurf/);
 const account=renderToStaticMarkup(await Account().catch(e=>{assert.match(e.message,/REDIRECT:\/login/);return createElement('p')}));assert.ok(account);
 globalThis.__accountClient=client();assert.match(renderToStaticMarkup(await Account()),/keine Firma zugeordnet/);
});


test('editorial badge is admin-only, hides zero, announces real counts and caps visible number',()=>{
 for(const total of [0,1,2,100]){const counts={profiles:total,advertising:0,verifications:0,total};const html=renderToStaticMarkup(createElement(AccountMenu,{access:'admin',taskCounts:counts}));assert.equal(html.includes('account-task-badge'),total>0);if(total){assert.match(html,new RegExp(total+' offene Redaktionsaufgaben'));assert.ok(html.includes('>'+ (total>99?'99+':total) +'</span>'));}}
 for(const access of ['unauthenticated','forbidden']){const html=renderToStaticMarkup(createElement(AccountMenu,{access,taskCounts:{total:2,profiles:2,advertising:0,verifications:0}}));assert.doesNotMatch(html,/account-task-badge|offene Redaktionsaufgaben/);}
 const failed=renderToStaticMarkup(createElement(AccountMenu,{access:'admin',taskError:'Failed'}));assert.match(failed,/Aufgabenzähler nicht verfügbar/);assert.doesNotMatch(failed,/account-task-badge/);
 const links=accountMenuGroups('admin').administration;assert.ok(links.some(l=>l.href==='/admin/firmen?ansicht=pruefung'));assert.ok(links.some(l=>l.href==='/admin/werbung?ansicht=pruefung'));
});
