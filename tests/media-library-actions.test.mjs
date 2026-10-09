import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};if(s==='@/lib/supabase/server')return {url:'data:text/javascript,export const createClient=async()=>globalThis.__mediaActionClient;',shortCircuit:true};if(s.startsWith('@/'))return n(new URL('../src/'+s.slice(2)+'.ts',import.meta.url).href,c);return n(s,c);}});
await import('./helpers/load-ts.mjs');
const {searchLibraryProfiles,libraryProfiles,updateLibraryAsset}=await import('../src/app/(energieheld)/admin/mediathek/actions.ts');
const {recordMediaPermission,readMediaRights,mediaMayUse}=await import('../src/lib/media-library.ts');
const profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',asset='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function client({admin=true,rights='Original license',rows=Array.from({length:31},(_,i)=>({id:String(i),display_name:'Company '+i}))}={}){
 const calls=[];let saved;const c={calls,get saved(){return saved;},auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},rpc:async n=>{calls.push(['rpc',n]);return{error:null};},from(table){const q={update(v){saved=v;return q;},select(){return q;},eq(){return q;},is(){return q;},order(v){calls.push(['order',v]);return q;},filter(...v){calls.push(['filter',...v]);return q;},range(...v){calls.push(['range',...v]);return Promise.resolve({data:rows,error:null});},async maybeSingle(){return table==='portal_admins'?{data:admin?{user_id:'admin'}:null,error:null}:table==='company_profiles'?{data:{id:profile,display_name:'Pension Sonnenhof'},error:null}:{data:saved?{id:asset}:{rights},error:null};}};return q;}};globalThis.__mediaActionClient=c;return c;
}
function form(){const f=new FormData();for(const [k,v] of Object.entries({name:'Bild',description:'',alt_text:'',source:'Original source',rights:'Original license',permission_profile:profile,permission_evidence:'Written authorization, gallery only',permission_scope:'gallery'}))f.set(k,v);return f;}
test('company results are server-filtered/paginated 30 at a time, alphabetic and admin-only',async()=>{
 const c=client();const r=await searchLibraryProfiles('Sonnen',2);assert.equal(r.items.length,30);assert.equal(r.more,true);assert.deepEqual(c.calls.find(v=>v[0]==='range'),['range',30,60]);assert.deepEqual(c.calls.filter(v=>v[0]==='order'),[['order','display_name'],['order','id']]);assert.equal(c.calls.find(v=>v[0]==='filter')[2],'imatch');
 const current=await libraryProfiles(profile);assert.equal(current.items[0].display_name,'Pension Sonnenhof');assert.equal(current.items.length,1);
 const denied=client({admin:false});assert.ok((await searchLibraryProfiles('Sonnen')).error);assert.equal(denied.calls.length,0);
});
test('saving documented permission preserves license/source and other scopes, survives reload and validates destination/type',async()=>{
 const c=client({rights:recordMediaPermission('Original license','Original license',other,'Other permission',['logo'])});assert.ok((await updateLibraryAsset(asset,form())).success);assert.equal(c.saved.source,'Original source');assert.equal(readMediaRights(c.saved.rights).license,'Original license');assert.equal(readMediaRights(c.saved.rights).permissions.length,2);assert.equal(mediaMayUse({rights:c.saved.rights,bucket_id:'ad-media',profile_id:null},profile,'gallery'),true);assert.equal(mediaMayUse({rights:c.saved.rights,bucket_id:'ad-media',profile_id:null},profile,'logo'),false);
 const reloaded=client({rights:c.saved.rights});const f=form();f.set('permission_evidence','');assert.ok((await updateLibraryAsset(asset,f)).success);assert.equal(readMediaRights(reloaded.saved.rights).permissions.length,1);
 for(const field of ['permission_profile','permission_scope']){const denied=client();const f=form();f.set(field,'invalid');assert.ok((await updateLibraryAsset(asset,f)).error);assert.equal(denied.saved,undefined);}
 const denied=client({admin:false});assert.ok((await updateLibraryAsset(asset,form())).error);assert.equal(denied.saved,undefined);
});
