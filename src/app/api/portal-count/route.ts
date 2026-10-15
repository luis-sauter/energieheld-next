import { readTravelFilterValues } from '@/lib/reiseportal-filter-options';
import { searchPortal } from '@/lib/portal-search';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  if (Object.entries(params).some(([key,value]) => value.length > (key === 'q' ? 160 : 80)))
    return Response.json({error:'Ungültige Suche.'},{status:400,headers});
  const values = readTravelFilterValues(params);
  try {
    const result=await searchPortal(values.query,{filters:values,countOnly:true,signal:request.signal});
    if(result.error || !Number.isSafeInteger(result.total) || result.total<0) throw Error('Unavailable');
    return Response.json({total:result.total},{headers});
  } catch {
    return Response.json({error:'Die Trefferzahl ist gerade nicht verfügbar.'},{status:503,headers});
  }
}
