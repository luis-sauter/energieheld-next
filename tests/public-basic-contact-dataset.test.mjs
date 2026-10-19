import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('downloadable Basic data exposes only unique public contact fields',async()=>{
 const data=JSON.parse(await readFile(new URL('../public/reiseportal/data/basic-contacts-20261018-austria-switzerland.json',import.meta.url),'utf8'));
 assert.equal(data.licence,'https://opendatacommons.org/licenses/odbl/1-0/');
 assert.equal(new Set(data.entries.map(e=>e.id)).size,data.entries.length);
 for(const entry of data.entries){
  assert.deepEqual(Object.keys(entry).sort(),['address','id','name','phone']);
  assert.ok(entry.name.trim());
  assert.match(entry.phone,/^\+[1-9][0-9]{6,14}$/);
  assert.ok(entry.address.city&&entry.address.country&&entry.address.region);
  assert.ok(Object.keys(entry.address).every(k=>['city','country','region','street','houseNumber','postalCode'].includes(k)));
 }
 const credit=await readFile(new URL('../src/components/portal/basic-source-credit.tsx',import.meta.url),'utf8');
 assert.ok(credit.includes('/reiseportal/data/basic-contacts-20261018-austria-switzerland.json'));
 assert.ok(credit.includes('STATISTIK AUSTRIA'));
 assert.ok(credit.includes('Federal Office of Topography swisstopo'));
});
