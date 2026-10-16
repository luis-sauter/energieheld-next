import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {prepareBasicPilot as prepare,publicBasicFields,visibleBasicContact,normalizeIdentityText,normalizePhone,priceComparison} from '../src/lib/basic-accommodation-pilot.ts';
const prepareBasicPilot=(records,existing,prior=[])=>prepare(records,existing,prior,['theme:wellnessangebote']);
registerHooks({load(url,context,next){if(url.endsWith('/basic-accommodation-card.module.css'))return{format:'module',shortCircuit:true,source:'export default {card:"basic-contact-card"}'};if(url.endsWith('/basic-accommodation-card.tsx'))return{format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,context);}});
const {BasicAccommodationCard}=await import('../src/components/portal/basic-accommodation-card.tsx');
const record=()=>({sourceKey:'official:sample-1',name:'Testhotel Äußere Mühle',accommodationType:'hotel',address:{country:'DE',region:'Bayern',municipality:'Beispielort',locality:'Beispielort',postalCode:'84364',addressLine:'Mühlenstraße 12a'},phone:'08563 / 12345'.replace(' / ',' '),website:'https://www.example.invalid',email:'private@example.invalid',contactPerson:'Private Person',operatorId:'operator-1',themes:['theme:wellnessangebote'],themeEvidence:[{feature:'Sauna im Haus',sourceUrl:'https://example.invalid/ausstattung'}],sources:[{url:'https://example.invalid',checkedAt:'2026-10-15T22:00:00Z',activityEvidence:'Current official lodging listing'}],price:null});
const existing=r=>({id:'existing-premium',display_name:r.name,street:r.address.addressLine,postal_code:r.address.postalCode,city:r.address.locality,country:'Deutschland',phone:r.phone,website:r.website});
const contact=()=>({id:'id',name:'Mühle',address:{country:'DE',region:'Bayern',city:'Beispielort',postalCode:'84364',street:'Mühlenstraße 12a',email:'hidden'},phone:'+49856312345',website:'https://private.invalid',email:'secret@example.invalid',contactPerson:'Private Person',description:'SECRET',sources:['INTERNAL'],operator:'SECRET'});
test('public projection permits only name, address and phone plus ID, including nested fields',()=>{
 const c=publicBasicFields(contact());assert.deepEqual(Object.keys(c),['id','name','address','phone']);assert.deepEqual(Object.keys(c.address),['country','region','city','postalCode','street']);assert.doesNotMatch(JSON.stringify(c),/website|email|private|secret|description|sources|operator|Person/i);
});
test('basic card has no image, email, website, description, tags or profile link',()=>{
 const html=renderToStaticMarkup(createElement(BasicAccommodationCard,{entry:contact()}));
 assert.match(html,/Mühle/);assert.match(html,/Mühlenstraße 12a/);assert.match(html,/href="tel:\+49856312345"/);assert.doesNotMatch(html,/<img|mailto:|https?:|SECRET|Private Person|Zum Profil|badge/);assert.equal((html.match(/href=/g)||[]).length,1);
});
test('normalization handles umlauts, German country labels and international/local business phones',()=>{
 assert.equal(normalizeIdentityText('  Äußere-Mühle '),'aussere muhle');
 for(const [raw,country,out] of [['08563 12345','DE','+49856312345'],['0049 (0)8563-12345','DE','+49856312345'],['0664 1234567','AT','+436641234567'],['044 1234567','CH','+41441234567'],['0471 123456','IT','+390471123456']])assert.equal(normalizePhone(raw,country),out);
 assert.equal(normalizePhone('08563/12345','DE'),'+49856312345');assert.equal(normalizePhone('0856312345 / 0856367890','DE'),'');assert.equal(normalizePhone('info@example.invalid','DE'),'');
});
test('multiple identity signals protect all existing profiles, including hidden or draft profiles',()=>{
 const r=record(),e=existing(r);e.status='draft';e.is_listed=false;e.directory_package='premium';
 const before=JSON.stringify(e),p=prepareBasicPilot([r],[e]);assert.equal(p.summary.existingProfiles,1);assert.equal(p.staged.length,0);assert.equal(JSON.stringify(e),before);
});
test('same name alone requires review, not a merge or competing publication',()=>{
 const r=record(),e={...existing(r),street:'Andere Straße 5',phone:'+49999999999',website:'https://different.invalid'};
 const p=prepareBasicPilot([r],[e]);assert.equal(p.summary.manualReview,1);assert.equal(p.staged.length,0);
});
test('one operator with different properties is never treated as the same lodging automatically',()=>{
 const a=record(),b={...record(),sourceKey:'official:2',name:'Zweites Haus',address:{...record().address,addressLine:'Andere Straße 9'}};
 const p=prepareBasicPilot([a,b],[]);assert.equal(p.staged.length,1);assert.equal(p.decisions[1].decision,'batch_identity_review');assert.notEqual(p.decisions[1].decision,'existing_profile');
 const sameBrand={...existing(a),street:'Andere Straße 99'};
 assert.equal(prepareBasicPilot([a],[sameBrand]).summary.manualReview,1);
});
test('missing phone, address, category, accommodation type, evidence or sources prevents staging',()=>{
 for(const change of [{phone:''},{address:{...record().address,addressLine:''}},{sources:[]},{themes:[]},{accommodationType:null},{sources:[{url:'https://example.invalid',checkedAt:'2026-10-15'}]},{themeEvidence:[{feature:'unknown',sourceUrl:'javascript:bad'}]}]){const p=prepareBasicPilot([{...record(),...change}],[]);assert.equal(p.summary.incomplete,1);assert.equal(p.staged.length,0);}
});
test('malformed input fails closed without throwing or inventing fields',()=>{
 for(const r of [null,{}, {...record(),themes:null},{...record(),phone:123},{...record(),address:{country:'DE'}}])assert.equal(prepareBasicPilot([r],[]).summary.incomplete,1);
});
test('a current allowed theme catalog is required; seasons and retired terms cannot qualify a Basic',()=>{
 assert.equal(prepare([record()],[]).summary.incomplete,1);
 for(const theme of ['theme:tauchurlaub','theme:saison-herbst','theme:invented'])assert.equal(prepareBasicPilot([{...record(),themes:[theme]}],[]).summary.incomplete,1);
});
const price=()=>({amount:100,currency:'EUR',basis:'person_night',board:'Frühstück',period:'2026',sourceUrl:'https://example.invalid/preise',extrasKnown:true,mandatoryExtraPerPersonNight:3.4});
test('unknown price/basis/extras remain unverified and cannot silently pass the budget',()=>{
 for(const p of [null,{...price(),basis:'unknown'},{...price(),extrasKnown:false},{...price(),period:null},{...price(),board:null},{...price(),amount:NaN},{...price(),sourceUrl:''}])assert.equal(priceComparison(p).eurPerPersonNight,null);
 const p=prepareBasicPilot([record()],[]);assert.equal(p.summary.priceUnverified,1);assert.equal(p.canPublish,false);
});
test('room and stay prices require occupancy and nights before conversion; add mandatory extras',()=>{
 assert.equal(priceComparison({...price(),amount:300,basis:'unit_night',occupancy:2}).eurPerPersonNight,153.4);
 assert.equal(priceComparison({...price(),amount:1200,basis:'stay',occupancy:2,nights:4}).eurPerPersonNight,153.4);
 assert.equal(priceComparison({...price(),basis:'unit_night'}).eurPerPersonNight,null);
 assert.equal(priceComparison({...price(),basis:'stay',occupancy:2}).eurPerPersonNight,null);
 assert.equal(priceComparison({...price(),amount:210}).status,'above_limit');
 assert.equal(priceComparison({...price(),isFromPrice:true}).status,'indicative_under_limit');
});
test('CHF is preserved as original currency and never converted with an invented exchange rate',()=>{
 assert.equal(priceComparison({...price(),currency:'CHF'}).status,'exchange_rate_required');assert.equal(priceComparison({...price(),currency:'CHF'}).eurPerPersonNight,null);
});
test('replayed imports preserve stable IDs and insert nothing; changed sources require review',()=>{
 const first=prepareBasicPilot([record()],[]),before=JSON.stringify(first.staged);
 const replay=prepareBasicPilot([record()],[],first.staged);assert.equal(replay.summary.unchanged,1);assert.deepEqual(replay.staged,first.staged);assert.equal(JSON.stringify(first.staged),before);
 const changed=prepareBasicPilot([{...record(),email:'changed@example.invalid'}],[],first.staged);assert.equal(changed.summary.manualReview,1);assert.deepEqual(changed.staged,first.staged);
});
test('different sources for the same lodging cannot produce adjacent duplicate identities',()=>{
 const r=record(),p=prepareBasicPilot([r,{...r,sourceKey:'other-provider:1'}],[]);assert.equal(p.staged.length,1);assert.equal(p.decisions[1].decision,'batch_identity_review');
});
test('public visibility requires approval AND listing; no pilot can publish',()=>{
 for(const status of ['draft','pending','rejected'])assert.equal(visibleBasicContact({...contact(),status,isListed:true}),null);
 assert.equal(visibleBasicContact({...contact(),status:'approved',isListed:false}),null);
 assert.deepEqual(visibleBasicContact({...contact(),status:'approved',isListed:true}),publicBasicFields(contact()));
 assert.equal(prepareBasicPilot([record()],[]).canPublish,false);
});
test('offline legacy preparation is not a runtime importer or public data source',()=>{
 for(const file of ['src/lib/portal-search.ts','src/lib/public-result-pages.ts','src/components/portal/travel-directory.tsx','src/components/portal/search-results.tsx'])assert.doesNotMatch(readFileSync(new URL('../'+file,import.meta.url),'utf8'),/from\s+['"][^'"]*basic-accommodation-pilot/);
 const script=readFileSync(new URL('../scripts/prepare-basic-accommodations.mjs',import.meta.url),'utf8');assert.doesNotMatch(script,/fetch\(|createClient\(|apply_migration|process\.env/);assert.match(script,/Private research output must stay outside/);
});
