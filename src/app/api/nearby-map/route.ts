import candidates from '@/data/basic-map-locations.json';
import { createPublicClient } from '@/lib/supabase/public';
import { basicMapFingerprint } from '@/lib/basic-map-locations';
import { distanceKm,readNearbyQuery } from '@/lib/nearby-map';
const headers={'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:Request) {
 const center=readNearbyQuery(new URL(request.url));
 if(!center)return Response.json({error:'Ungültiger Umkreis.'},{status:400,headers});
 try {
  const inRadius=candidates.map(row=>({...row,distance:distanceKm(center,row)})).filter(row=>row.distance<=center.radius).sort((a,b)=>a.distance-b.distance);
  const chosen=inRadius.slice(0,500);
  if(!chosen.length)return Response.json({points:[],labels:[],limited:false},{headers});
  const {data,error}=await createPublicClient().rpc('public_basic_map_contacts_by_ids',{p_ids:chosen.map(row=>row.id)}).abortSignal(AbortSignal.timeout(8000));
  if(error||!Array.isArray(data))throw Error('Map unavailable');
  const current=new Map(data.map(row=>[row.id,basicMapFingerprint(row.address??{})]));
  const points=chosen.filter(row=>current.get(row.id)===row.address_fingerprint).map(row=>[row.lat,row.lon]);
  const addresses=new Map(data.map(row=>[row.id,row.address]));
  const labels:{lat:number;lon:number;name:string}[]=[];
  for(const row of chosen){
   const name=addresses.get(row.id)?.city;
   if(current.get(row.id)!==row.address_fingerprint||typeof name!=='string'||!name.trim()||labels.some(label=>label.name===name||distanceKm(label,row)<3))continue;
   labels.push({lat:row.lat,lon:row.lon,name:name.slice(0,80)});if(labels.length===8)break;
  }
  return Response.json({points,labels,limited:inRadius.length>500},{headers});
 }catch{return Response.json({error:'Standorte konnten nicht geladen werden.'},{status:503,headers});}
}
