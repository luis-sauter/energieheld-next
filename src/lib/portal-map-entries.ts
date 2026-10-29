export type PortalMapEntry={id:string;lat:number;lon:number;kind:'basic'|'profile'};
export type PortalMapData={entries:PortalMapEntry[];limited:boolean;overview:boolean};
export function validPortalMapData(value:unknown):value is PortalMapData {
 if(!value||typeof value!=='object')return false;
 const data=value as PortalMapData;
 return typeof data.limited==='boolean'&&typeof data.overview==='boolean'&&Array.isArray(data.entries)&&data.entries.length<=500&&
  new Set(data.entries.map(e=>e?.id)).size===data.entries.length&&data.entries.every(e=>e&&typeof e.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(e.id)&&
   Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&e.lat>=34&&e.lat<=72&&e.lon>=-25&&e.lon<=45&&
   (e.kind==='basic'||e.kind==='profile'));
}
