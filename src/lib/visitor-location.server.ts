import 'server-only';
import {isAbsolute} from 'node:path';
import {open,type CityResponse,type Reader} from 'maxmind';
import {visitorIp,coarseVisitorLocation} from './visitor-location';

let cachedPath='',reader:Promise<Reader<CityResponse>>|undefined;
export async function localVisitorLocation(headers:Headers){
 const ip=visitorIp(headers,process.env),path=process.env.VISITOR_GEO_DB_PATH;
 if(!ip||!path||!isAbsolute(path))return null;
 try{
  if(!reader||cachedPath!==path){cachedPath=path;reader=open<CityResponse>(path,{cache:{max:1000},watchForUpdates:false});}
  return coarseVisitorLocation((await reader).get(ip));
 }catch{
  // A missing/corrupt DB cannot expose filesystem details or substitute a fake location.
  return null;
 }
}
