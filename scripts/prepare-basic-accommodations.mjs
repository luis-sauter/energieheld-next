// Local files only. Deliberately no network, database client or apply mode.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareBasicPilot} from '../src/lib/basic-accommodation-pilot.ts';
const args=process.argv.slice(2),values={};
if(args.length%2)throw Error('Expected --input FILE --existing FILE --out PRIVATE_DIRECTORY [--state FILE]');
for(let i=0;i<args.length;i+=2){if(!['--input','--existing','--out','--state'].includes(args[i])||values[args[i]])throw Error('Unknown or duplicate option');values[args[i]]=args[i+1];}
if(!values['--input']||!values['--existing']||!values['--out'])throw Error('Missing local paths');
const repo=await realpath(path.resolve(fileURLToPath(new URL('..',import.meta.url))));
await mkdir(path.resolve(values['--out']),{recursive:true});
const out=await realpath(path.resolve(values['--out']));
const relative=path.relative(repo,out);
if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw Error('Private research output must stay outside the application repository');
async function json(file){const text=await readFile(file,'utf8');if(Buffer.byteLength(text)>5_000_000)throw Error('Pilot file exceeds 5MB bound');return JSON.parse(text);}
const input=await json(values['--input']),snapshot=await json(values['--existing']);
const records=input.records??input,existing=snapshot.profiles??snapshot;
if(!Array.isArray(records)||records.length>100||!Array.isArray(existing)||existing.length>500||snapshot.total>existing.length)throw Error('Invalid or truncated pilot/index');
const prior=values['--state']?await json(values['--state']):[];
if(!Array.isArray(snapshot.terms))throw Error('Current taxonomy snapshot required');
const themes=snapshot.terms.filter(t=>t.dimension==='theme'&&!t.slug.startsWith('saison-')&&t.slug!=='tauchurlaub').map(t=>t.term_key);
const plan=prepareBasicPilot(records,existing,prior,themes);
await writeFile(path.join(out,'import-report.json'),JSON.stringify({...plan,staged:undefined,publicPreview:undefined},null,2));
await writeFile(path.join(out,'internal-stage.json'),JSON.stringify(plan.staged,null,2));
await writeFile(path.join(out,'public-preview.json'),JSON.stringify(plan.publicPreview,null,2));
console.log(JSON.stringify({mode:plan.mode,canPublish:plan.canPublish,...plan.summary}));
