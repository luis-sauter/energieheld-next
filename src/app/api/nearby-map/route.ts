import candidates from '@/data/basic-map-locations.json';
import { createPublicClient } from '@/lib/supabase/public';
import { basicMapFingerprint } from '@/lib/basic-map-locations';
import { distanceKm,readNearbyQuery } from '@/lib/nearby-map';
import companyLocations from '@/data/company-locations.json';
import companyAddresses from '@/data/company-location-addresses.json';
import {createHash} from 'node:crypto';
import {isPubliclyListed} from '@/lib/profile-public-visibility';
import {demoProfileId} from '@/lib/reiseportal-demo';
import type {PortalMapEntry} from '@/lib/portal-map-entries';
const headers={'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:Request) {
 const url=new URL(request.url),overview=url.searchParams.get('view')==='overview',center=readNearbyQuery(url);
 if(!overview&&!center)return Response.json({error:'Ungültiger Umkreis.'},{status:400,headers});
 try {
  const profiles=companyLocations.filter(row=>row.id!==demoProfileId&&(overview||distanceKm(center!,row)<=center!.radius));
  const inRadius=overview?candidates:candidates.map(row=>({...row,distance:distanceKm(center!,row)})).filter(row=>row.distance<=center!.radius).sort((a,b)=>a.distance-b.distance);
  const budget=Math.max(0,500-profiles.length);
  // Overview is an explicitly labelled, deterministic selection, never invented locations.
  const chosen=overview?Array.from({length:Math.min(budget,inRadius.length)},(_,i)=>inRadius[Math.floor(i*inRadius.length/Math.min(budget,inRadius.length))]):inRadius.slice(0,budget);
  const client=createPublicClient();
  const [{data,error},profileResult]=await Promise.all([
   client.rpc('public_basic_map_entries_by_ids',{p_ids:chosen.map(row=>row.id)}).abortSignal(AbortSignal.timeout(8000)),
   profiles.length?client.from('company_profiles').select('id,slug,display_name,street,postal_code,city,country,company_profile_public_visibility(is_listed)').eq('status','approved').in('id',profiles.map(row=>row.id)).abortSignal(AbortSignal.timeout(8000)):Promise.resolve({data:[],error:null}),
  ]);
  if(error||!Array.isArray(data))throw Error('Map unavailable');
  if(profileResult.error)throw Error('Profiles unavailable');
  const current=new Map(data.map(row=>[row.id,row]));
  const entries:PortalMapEntry[]=[];
  for(const row of chosen){const record=current.get(row.id);if(!record||typeof record.name!=='string'||!record.name.trim()||basicMapFingerprint(record.address??{})!==row.address_fingerprint)continue;
   entries.push({id:row.id,lat:row.lat,lon:row.lon,kind:'basic'});
  }
  const positions=new Map(profiles.map(row=>[row.id,row]));
  for(const profile of profileResult.data??[]){
   if(!isPubliclyListed(profile))continue;
   const fingerprint=createHash('sha256').update([profile.street,profile.postal_code,profile.city,profile.country].map(value=>(value??'').normalize('NFC').trim().toLocaleLowerCase('de')).join('|')).digest('hex');
   const row=positions.get(profile.id);if(!row||(companyAddresses as Record<string,string>)[profile.id]!==fingerprint||!/^[a-z0-9-]+$/.test(profile.slug))continue;
   if(typeof profile.display_name!=='string'||!profile.display_name.trim())continue;
   entries.push({id:profile.id,lat:row.lat,lon:row.lon,kind:'profile'});
  }
  return Response.json({entries,overview,limited:inRadius.length>chosen.length},{headers});
 }catch{return Response.json({error:'Standorte konnten nicht geladen werden.'},{status:503,headers});}
}
