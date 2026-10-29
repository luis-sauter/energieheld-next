// Netlify handles this exact path at its edge using trusted visitor geolocation.
// A self-hosted deployment deliberately returns no invented server location.
export async function GET() {return Response.json({location:null},{headers:{'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});}
