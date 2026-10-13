import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';

test('local generator handles reviewed profile/advertiser sites without replacing verified coordinates or ambiguous assignments',()=>{
 const dir=mkdtempSync(join(tmpdir(),'portal-map-generator-'));
 try {
  for(const folder of ['scripts','src/lib','src/data'])mkdirSync(join(dir,folder),{recursive:true});
  copyFileSync(new URL('../scripts/build-europe-map.mjs',import.meta.url),join(dir,'scripts/build-europe-map.mjs'));
  copyFileSync(new URL('../src/lib/europe-map.ts',import.meta.url),join(dir,'src/lib/europe-map.ts'));
  const write=(name,value)=>writeFileSync(join(dir,name),JSON.stringify(value));
  write('countries.json',{features:[]});
  write('profiles.json',[{id:'public',street:'Address 1',postal_code:'10000',city:'Place',country:'Deutschland'}]);
  write('src/data/company-locations.json',[{id:'public',lat:49,lon:10}]);
  const reviewed=[{id:'public',lat:49,lon:10,verified:true},{id:'advertiser:site',lat:48,lon:11,verified:true},{id:'uncertain',lat:48,lon:12,verified:false}];
  const advertisers=[{locationId:'advertiser:site',advertiserKey:'domain:example.test',campaignIds:['active-id']}];
  write('reviewed.json',reviewed);write('advertisers.json',advertisers);
  const run=()=>spawnSync(process.execPath,['scripts/build-europe-map.mjs','countries.json','profiles.json','reviewed.json','advertisers.json'],{cwd:dir,encoding:'utf8',timeout:15000});
  assert.equal(run().status,0);
  assert.deepEqual(JSON.parse(readFileSync(join(dir,'src/data/company-locations.json'),'utf8')),[{id:'public',lat:49,lon:10},{id:'advertiser:site',lat:48,lon:11}]);
  const unchanged=readFileSync(join(dir,'src/data/company-locations.json'),'utf8');
  write('reviewed.json',reviewed.map(r=>r.id==='public'?{...r,lat:50}:r));
  assert.notEqual(run().status,0);assert.equal(readFileSync(join(dir,'src/data/company-locations.json'),'utf8'),unchanged);
  write('reviewed.json',reviewed.slice(1));assert.notEqual(run().status,0);
  write('reviewed.json',reviewed);write('advertisers.json',[...advertisers,{...advertisers[0],locationId:'second-unproven-site'}]);
  assert.notEqual(run().status,0);assert.equal(readFileSync(join(dir,'src/data/company-locations.json'),'utf8'),unchanged);
 }finally {
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep+'portal-map-generator-'))throw new Error('Unsafe fixture cleanup path');
  rmSync(dir,{recursive:true,force:true});
 }
});
