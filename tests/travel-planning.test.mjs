import {test} from 'node:test';
import assert from 'node:assert/strict';
import {legacyTravelRedirect as redirect, legacyProfileRewrite} from '../src/lib/legacy-travel-redirect.ts';
import {travelSeo} from '../src/data/travel-seo.ts';
test('real Joomla spellings and query parameters become current URLs without losing modern filters',()=>{
 assert.equal(redirect('/reiseziele/%C3%B6sterreich','?types[0]=1'),'/reiseziele/oesterreich');
 assert.equal(redirect('/reiseziele/südtirol-italien',''),'/reiseziele/suedtirol-italien');
 assert.equal(redirect('/mottoreisen/gesch%C3%A4ftsreisen','?types[0]=1'),'/mottoreisen/geschaeftsreisen');
 assert.equal(redirect('/unterk%C3%BCnfte-a-z','?filter[bd_category][0]=Natur%20pur&ziel=deutschland'),'/unterkuenfte-a-z?ziel=deutschland&thema=natur-pur');
 assert.equal(redirect('/mottoreisen/radwandern','?types[0]=1'),'/mottoreisen/radwandern');
});
test('current routes, unknown categories and private requests are not guessed or redirected in loops',()=>{
 assert.equal(redirect('/mottoreisen/radwandern',''),null);
 assert.equal(redirect('/admin','?types[0]=1'),null);
 assert.equal(redirect('/unterkuenfte-a-z','?filter[bd_category][0]=Tauchurlaub'),null);
 assert.equal(redirect('/%broken',''),null);
 assert.equal(redirect('//external.example','?types[0]=1'),null);
});
test('all current countries and themes have distinct metadata without hidden editorial copy',()=>{
 assert.equal(Object.keys(travelSeo).length,16);
 assert.equal(new Set(Object.values(travelSeo).map(x=>x.description)).size,16);
 for(const entry of Object.values(travelSeo)){
  assert.deepEqual(Object.keys(entry).sort(),['description','title']);
  assert.ok(entry.description.length<180);
  assert.doesNotMatch(entry.description,/Andreus|Sonnenhof|Tagungsräume/);
 }
});

test('legacy profile paths rewrite internally without guessing a provider or accepting nested paths',()=>{
 assert.equal(legacyProfileRewrite('/unterk%C3%BCnfte-a-z/liste/bayerischer-wald'),'/unterkuenfte-a-z/liste/bayerischer-wald');
 assert.equal(legacyProfileRewrite('/unterkünfte-a-z/liste/not-known'),'/unterkuenfte-a-z/liste/not-known');
 assert.equal(legacyProfileRewrite('/unterkünfte-a-z/liste/a%2Fb'),null);
 assert.equal(legacyProfileRewrite('/admin'),null);
});
