import {localVisitorLocation} from '@/lib/visitor-location.server';
export const runtime='nodejs';
// Netlify keeps using its existing edge handler. Self-hosting opts into a local
// read-only MMDB and a proxy-overwritten header; no visitor IP leaves the server.
export async function GET(request:Request) {
 const location=await localVisitorLocation(request.headers);
 return Response.json({location,...(location?{source:'db-ip'}:{})},{headers:{'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
