import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { projectLocation, MAP_WIDTH, MAP_HEIGHT } from '../src/lib/europe-map.ts';
const [countriesFile, profilesFile, reviewedFile, advertisersFile] = process.argv.slice(2);
if (!countriesFile || !profilesFile || !reviewedFile) throw new Error('Usage: node scripts/build-europe-map.mjs countries.geojson public-profiles.json reviewed-locations.json (local files only)');
const countries = JSON.parse(await fs.readFile(countriesFile, 'utf8'));
const profiles = JSON.parse(await fs.readFile(profilesFile, 'utf8'));
const reviewed = JSON.parse(await fs.readFile(reviewedFile, 'utf8'));
const rounded = n => Math.round(n * 10) / 10;
// Douglas-Peucker simplification in projected SVG units, at most .65 px.
function simplify(points) {
 if (points.length < 3) return points;
 const [a,b] = [points[0], points.at(-1)]; let index = 0, max = 0;
 for (let i=1;i<points.length-1;i++) {
   const [x,y] = points[i], dx=b[0]-a[0],dy=b[1]-a[1];
   const t = dx || dy ? Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))) : 0;
   const distance = Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
   if (distance > max) { max=distance; index=i; }
 }
 return max <= .65 ? [a,b] : [...simplify(points.slice(0,index+1)).slice(0,-1), ...simplify(points.slice(index))];
}
const paths = [];
function clip(points) {
 for (const [axis, edge, lower] of [[0,-1,true],[0,MAP_WIDTH+1,false],[1,-1,true],[1,MAP_HEIGHT+1,false]]) {
   const input=points; points=[];
   for(let i=0;i<input.length;i++) {
     const a=input[(i+input.length-1)%input.length],b=input[i];
     const inside=p=>lower?p[axis]>=edge:p[axis]<=edge;
     if(inside(a)!==inside(b)) { const t=(edge-a[axis])/(b[axis]-a[axis]); points.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]); }
     if(inside(b)) points.push(b);
   }
 }
 return points;
}
for (const feature of countries.features) {
 const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
 const rings = polygons.flatMap(polygon=>polygon.map(ring=> {
   if (!ring.some(([lon,lat])=>lon>=-35 && lon<=55 && lat>=28 && lat<=75)) return '';
   const clipped = clip(ring.map(([lon,lat])=>projectLocation(lat,lon)));
   if (clipped.length < 3) return '';
   const points = simplify([...clipped, clipped[0]]);
   return 'M'+points.map(([x,y])=>`${rounded(x)},${rounded(y)}`).join('L')+'Z';
 })).filter(Boolean);
 if (rings.length) paths.push(`<path d="${rings.join('')}"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}"><title>Europa — Natural Earth, Lambert-Kegelprojektion</title><defs><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#a9bfc5"/><stop offset="1" stop-color="#bdced0"/></linearGradient><linearGradient id="land" x2="0.4" y2="1"><stop stop-color="#f0ede4"/><stop offset="1" stop-color="#e3ddce"/></linearGradient></defs><path fill="url(#sea)" d="M0 0H${MAP_WIDTH}V${MAP_HEIGHT}H0Z"/><g fill="url(#land)" stroke="#fcfaf4" stroke-width=".8" stroke-linejoin="round" fill-rule="evenodd">${paths.join('')}</g></svg>`;
if (Buffer.byteLength(svg) > 150000) throw new Error('Map exceeds size budget');
const advertisers = advertisersFile ? JSON.parse(await fs.readFile(advertisersFile,'utf8')) : [];
const eligibility = new Set();
for (const entry of advertisers) {
 if (!entry.locationId || !entry.advertiserKey || !Array.isArray(entry.campaignIds) || !entry.campaignIds.length) throw new Error('Reviewed advertiser identity/campaigns required');
 for (const campaign of entry.campaignIds) {
  const key=entry.advertiserKey+'|'+campaign;
  if(eligibility.has(key))throw new Error('Ambiguous campaign/site assignment');
  eligibility.add(key);
 }
}
const ids = new Set([...profiles.map(p=>p.id),...advertisers.map(p=>p.locationId)]);
const locations = reviewed.filter(p=>p.verified === true && ids.has(p.id)).map(({id,lat,lon})=>({id,lat,lon}));
// Published verified coordinates are immutable during an extension. A changed
// business location requires an explicit reviewed update, not a silent rebuild.
const existing = JSON.parse(await fs.readFile(new URL('../src/data/company-locations.json',import.meta.url),'utf8'));
for (const previous of existing) {
 const next=locations.find(p=>p.id===previous.id);
 if (ids.has(previous.id) && !next) throw new Error('Still eligible verified coordinate omitted from review');
 if (next && (next.lat!==previous.lat||next.lon!==previous.lon)) throw new Error('Verified coordinate replacement requires explicit review');
}
if (new Set(locations.map(p=>p.id)).size !== locations.length) throw new Error('Duplicate public ID');
for (const p of locations) {
 const [x,y]=projectLocation(p.lat,p.lon);
 if (x<0||x>MAP_WIDTH||y<0||y>MAP_HEIGHT) throw new Error('Location outside Europe viewport');
}
const addressKey = p => [p.street,p.postal_code,p.city,p.country].map(x=>(x??'').normalize('NFC').trim().toLocaleLowerCase('de')).join('|');
const fingerprints = Object.fromEntries(profiles.filter(p=>locations.some(l=>l.id===p.id)).map(p=>[p.id,createHash('sha256').update(addressKey(p)).digest('hex')]));
await fs.mkdir(new URL('../public/reiseportal/maps/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../public/reiseportal/maps/europe.svg',import.meta.url),svg);
await fs.writeFile(new URL('../src/data/company-locations.json',import.meta.url),JSON.stringify(locations)+'\n');
await fs.writeFile(new URL('../src/data/company-location-addresses.json',import.meta.url),JSON.stringify(fingerprints)+'\n');
if (advertisersFile) await fs.writeFile(new URL('../src/data/company-location-advertisers.json',import.meta.url),JSON.stringify(advertisers)+'\n');
console.log(JSON.stringify({locations:locations.length,excluded:profiles.length-locations.length,svgBytes:Buffer.byteLength(svg),locationBytes:Buffer.byteLength(JSON.stringify(locations))}));
