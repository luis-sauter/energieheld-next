import { createClient } from '@/lib/supabase/server';
import { checkAdmin, isProfileId } from '@/lib/admin-review';
import { offerImageDownloadName } from '@/lib/offer-image-download';

const headers={'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {id}=await params;
  const client=await createClient();
  if(await checkAdmin(client)!=='admin') return new Response('Keine Berechtigung.',{status:403,headers});
  if(!isProfileId(id)) return new Response('Bild nicht gefunden.',{status:404,headers});
  const {data,error}=await client.from('company_ad_campaigns').select('image_path,request_status,request_details').eq('id',id).maybeSingle();
  const path=data?.image_path;
  if(error||!data?.request_status||typeof path!=='string'||!path.startsWith(`campaigns/${id}/creative/`)||!/^campaigns\/[0-9a-f-]{36}\/creative\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path)) return new Response('Das Anfragebild ist nicht verfügbar.',{status:404,headers});
  const file=await client.storage.from('ad-media').download(path);
  if(file.error||!file.data) return new Response('Das Bild konnte nicht geladen werden. Bitte versuchen Sie es erneut.',{status:503,headers});
  const extension=path.split('.').pop()!;
  const filename=offerImageDownloadName(data.request_details?.image_name,extension,id);
  return new Response(file.data,{headers:{...headers,'Content-Type':extension==='jpg'?'image/jpeg':`image/${extension}`,'Content-Length':String(file.data.size),'Content-Disposition':`attachment; filename="Banner-${id}.${extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`}});
 } catch {return new Response('Das Bild ist gerade nicht erreichbar.',{status:503,headers});}
}
