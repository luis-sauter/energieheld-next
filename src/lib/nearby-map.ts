export function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}) {
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function readNearbyQuery(url:URL) {
 const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon')),radius=Number(url.searchParams.get('radius'));
 if(!url.searchParams.has('lat')||!url.searchParams.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<34||lat>72||lon< -25||lon>45||![20,50,75,100].includes(radius))return null;
 return {lat,lon,radius};
}

// Spread the bounded selection across the requested area rather than spending
// all 500 slots on the dense city centre. Coordinates and public eligibility
// remain unchanged; the route still validates every selected ID/address live.
export function selectNearbyLocations<T extends {lat:number;lon:number}>(rows:readonly T[],budget:number,center:{lat:number;lon:number;radius:number}):T[] {
 const limit=Math.max(0,Math.floor(budget));
 if(!limit)return [];
 if(rows.length<=limit)return [...rows];
 const cellSize=center.radius/8,longitudeScale=111.32*Math.cos(center.lat*Math.PI/180);
 const cells=new Map<string,T[]>();
 for(const row of rows){
  const key=`${Math.floor((row.lon-center.lon)*longitudeScale/cellSize)}:${Math.floor((row.lat-center.lat)*111.32/cellSize)}`;
  const cell=cells.get(key);if(cell)cell.push(row);else cells.set(key,[row]);
 }
 const selected:T[]=[],groups=[...cells.values()];
 for(let depth=0;selected.length<limit;depth++){
  let found=false;
  for(const group of groups){if(group[depth]){selected.push(group[depth]);found=true;if(selected.length===limit)break;}}
  if(!found)break;
 }
 return selected;
}
