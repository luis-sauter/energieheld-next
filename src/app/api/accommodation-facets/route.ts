import {basicIntegrationEnabled,loadAccommodationPage} from '@/lib/basic-public-search';
import {readTravelFilterValues} from '@/lib/reiseportal-filter-options';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:Request){
  if(!basicIntegrationEnabled())return Response.json({error:'Nicht verfügbar.'},{status:404,headers});
  const params=Object.fromEntries(new URL(request.url).searchParams);
  if(Object.values(params).some(v=>v.length>80))return Response.json({error:'Ungültige Filter.'},{status:400,headers});
  try{const page=await loadAccommodationPage('',readTravelFilterValues(params),null,{countOnly:true,facets:true,signal:request.signal});
    return Response.json({items:[{id:'facets',total:page.total,facets:page.facets}],total:1,nextCursor:null},{headers});
  }catch{return Response.json({error:'Die Filterzahlen sind gerade nicht verfügbar.'},{status:503,headers});}
}
