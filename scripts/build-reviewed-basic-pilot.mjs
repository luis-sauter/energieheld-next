import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewedPilotSql} from './lib/reviewed-basic-pilot.mjs';
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--manifest'||args[2]!=='--out')throw Error('Usage: --manifest PRIVATE.json --out PRIVATE_DIRECTORY. No apply mode.');
const repo=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const input=realpathSync(args[1]),out=path.resolve(args[3]);
function outsideRepo(target){const relative=path.relative(repo,target);if(relative===''||!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('Private research output must stay outside the application repository');}
outsideRepo(input);outsideRepo(out);mkdirSync(out,{recursive:true});outsideRepo(realpathSync(out));
const sql=reviewedPilotSql(JSON.parse(readFileSync(input,'utf8')));
writeFileSync(path.join(out,'apply-reviewed-basic-pilot.sql'),sql,{flag:'wx'});
console.log(JSON.stringify({mode:'review_only',canApply:false,canPublish:false,files:1}));
