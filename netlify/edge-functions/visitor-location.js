// Only this lightweight endpoint uses the platform's IP geolocation. No IP is
// forwarded to another provider, returned to the browser or stored by the app.
export default async function handler(_request,context) {
 const geo=context.geo,lat=geo?.latitude,lon=geo?.longitude;
 const location=typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=34&&lat<=72&&lon>=-25&&lon<=45
  ? {lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100,city:typeof geo.city==='string'?geo.city.slice(0,100):''}:null;
 return Response.json({location},{headers:{'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
export const config={path:'/api/visitor-location'};
