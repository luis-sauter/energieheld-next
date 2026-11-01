import {BlockList,isIP} from 'node:net';
import type {CityResponse} from 'maxmind';

const privateNetworks=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)privateNetworks.addSubnet(address,prefix,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
privateNetworks.addSubnet('2001:db8::',32,'ipv6');

// Only a reverse proxy which OVERWRITES this header may enable the opt-in.
// Never infer a visitor from the server IP, query parameters or arbitrary XFF.
export function visitorIp(headers:Headers,env:NodeJS.ProcessEnv):string|null {
 if(env.VISITOR_LOCATION_TRUST_PROXY!=='true')return null;
 let ip=headers.get('x-portal-client-ip')?.trim();
 if(!ip||ip.length>64||ip.includes(','))return null;
 if(ip.toLowerCase().startsWith('::ffff:')&&isIP(ip.slice(7))===4)ip=ip.slice(7);
 const version=isIP(ip);
 if(version===4)return privateNetworks.check(ip,'ipv4')?null:ip;
 if(version===6)return globalV6.check(ip,'ipv6')&&!privateNetworks.check(ip,'ipv6')?ip:null;
 return null;
}
export function coarseVisitorLocation(record:CityResponse|null){
 const lat=record?.location?.latitude,lon=record?.location?.longitude;
 if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<34||lat>72||lon< -25||lon>45)return null;
 const city=record?.city?.names?.de??record?.city?.names?.en??'';
 return {lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100,city:typeof city==='string'?city.replace(/[<>\u0000-\u001f\u007f]/g,'').slice(0,100):''};
}
