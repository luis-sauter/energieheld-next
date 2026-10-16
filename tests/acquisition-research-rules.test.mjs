import test from 'node:test';import assert from 'node:assert/strict';
import {ACTIVE_RESEARCH_THEMES,reviewResearchBatch,legalResearchTargets,verifiedBusinessContact} from '../scripts/lib/acquisition-research-rules.mjs';
const claim=(key,strength='service')=>({key:'theme:'+key,strength,fact:'Verified actual service',sameBusiness:true,url:'https://lodging.example/golf'});
test('reviews all eleven themes; incidental marketing is insufficient, all supported filters remain',()=>{
 const [r]=reviewResearchBatch([{id:'one',claims:[claim('wellnessangebote','mention'),claim('golfurlaub'),claim('radwandern')]}]);
 assert.equal(ACTIVE_RESEARCH_THEMES.length,11);assert.equal(r.matrix.length,11);assert.deepEqual(r.automatic,['theme:golfurlaub','theme:radwandern']);assert.equal(r.matrix.find(m=>m.key==='theme:wellnessangebote').status,'mention_only');
});
test('primary selection is deterministic across input order, specializes before balancing and preserves secondary evidence',()=>{
 const input=[{id:'a',claims:[claim('wellnessangebote','specialization')]},{id:'b',claims:[claim('wellnessangebote'),claim('golfurlaub')]},{id:'c',claims:[claim('wellnessangebote','specialization'),claim('golfurlaub')]}];
 const a=reviewResearchBatch(input);assert.deepEqual(a,reviewResearchBatch([...input].reverse()));assert.equal(a.find(r=>r.id==='b').preferred,'theme:golfurlaub');assert.equal(a.find(r=>r.id==='c').preferred,'theme:wellnessangebote');assert.equal(a.find(r=>r.id==='c').effective.length,2);
});
test('human inclusions/exclusions override future source bases without discarding original evidence',()=>{
 const [r]=reviewResearchBatch([{id:'one',claims:[claim('wellnessangebote')],manualDecisions:{'theme:wellnessangebote':false,'theme:golfurlaub':true}}]);
 assert.deepEqual(r.effective,['theme:golfurlaub']);assert.equal(r.preferred,'theme:golfurlaub');assert.deepEqual(r.automatic,['theme:wellnessangebote']);assert.throws(()=>reviewResearchBatch([{id:'one',claims:[claim('tauchurlaub')]}]),/Inactive/);
});
test('legal research uses first-party imprint targets, excludes image impressions and does not invent a sales role',()=>{
 assert.deepEqual(legalResearchTargets('https://hotel.example',[{url:'/impressionen',label:'Impressionen'},{url:'/about',label:'Impressum'},{url:'https://agency.example/impressum',label:'Impressum'}]),['https://hotel.example/about']);
 const evidence={name:'Erika Beispiel',role:'Geschäftsführerin',sourceUrl:'https://hotel.example/impressum',sourceText:'Geschäftsführerin: Erika Beispiel',sameBusiness:true,checkedAt:'2026-10-16T18:00:00Z'};
 assert.equal(verifiedBusinessContact(evidence).role,'Geschäftsführerin');assert.throws(()=>verifiedBusinessContact({...evidence,role:'Marketing'}),/Explicit/);assert.throws(()=>verifiedBusinessContact({...evidence,sameBusiness:false}),/Explicit/);
});
