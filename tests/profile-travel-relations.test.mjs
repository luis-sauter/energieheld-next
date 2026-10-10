import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({resolve(s,c,next){
 if(s==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
 if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c)}return next(s,c);
},load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(u,c)}});
const {TravelRelations}=await import('../src/components/portal/travel-relations.tsx');
test('assigned travel facts and destination/theme links are grouped and remain in server HTML without duplicates',()=>{
 const facts=[{term_key:'accommodation:hotel',dimension:'accommodation',slug:'hotel',label:'Hotel'},{term_key:'audience:familie',dimension:'audience',slug:'familie',label:'Familie'}];
 const links=[{name:'Radwandern',path:'/mottoreisen/radwandern'},{name:'Südtirol/Italien',path:'/reiseziele/suedtirol-italien'},{name:'Radwandern',path:'/mottoreisen/radwandern'}];
 const html=renderToStaticMarkup(createElement(TravelRelations,{title:'Reiseinformationen',facts:[...facts,facts[0]],links}));
 for(const label of ['Unterkunftsart','Für wen passt die Unterkunft?','Reisethemen','Reiseziele'])assert.ok(html.includes(label));
 for(const href of ['/mottoreisen/radwandern','/reiseziele/suedtirol-italien','/unterkuenfte-a-z?unterkunftstyp=hotel','/unterkuenfte-a-z?zielgruppe=familie'])assert.equal(html.split('href="'+href+'"').length-1,1);
 assert.doesNotMatch(html,/Nordic Walking|Deutschland|Gut zu wissen/);
});
test('empty travel data renders nothing; feature facts do not invent a removed filter link',()=>{
 assert.equal(renderToStaticMarkup(createElement(TravelRelations,{title:'Reiseinformationen',links:[]})),'');
 const html=renderToStaticMarkup(createElement(TravelRelations,{title:'Reiseinformationen',links:[],facts:[{term_key:'feature:barrierefrei',dimension:'feature',slug:'barrierefrei',label:'Barrierefrei'}]}));
 assert.match(html,/Barrierefrei/);assert.doesNotMatch(html,/href=|besonderheit=/);
});
