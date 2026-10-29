export function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}) {
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function readNearbyQuery(url:URL) {
 const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')),radius=Number(url.searchParams.get('radius'));
 if(!url.searchParams.has('lat')||!url.searchParams.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<34||lat>72||lon< -25||lon>45||![20,50].includes(radius))return null;
 return {lat,lon,radius};
}
