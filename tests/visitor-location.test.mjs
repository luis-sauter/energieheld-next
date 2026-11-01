import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
const {visitorIp,coarseVisitorLocation}=await import('../src/lib/visitor-location.ts');
const env={VISITOR_LOCATION_TRUST_PROXY:'true'};
const headers=ip=>new Headers({'x-portal-client-ip':ip});
test('visitor IP requires explicit trusted-proxy opt-in and ignores query/XFF style substitutes',()=>{
 assert.equal(visitorIp(headers('193.99.144.80'),{}),null);
 assert.equal(visitorIp(new Headers({'x-forwarded-for':'193.99.144.80'}),env),null);
 assert.equal(visitorIp(headers('193.99.144.80'),env),'193.99.144.80');
 assert.equal(visitorIp(headers('::ffff:193.99.144.80'),env),'193.99.144.80');
 assert.equal(visitorIp(headers('2001:4860:4860::8888'),env),'2001:4860:4860::8888');
});
test('private, malformed, multiple, multicast and documentation addresses cannot become visitor locations',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.5','192.168.1.1','100.64.0.1','169.254.169.254','0.0.0.0','224.0.0.1','255.255.255.255','192.0.2.1','198.51.100.1','203.0.113.1','::1','fc00::1','fe80::1','2001:db8::1','193.99.144.80, 8.8.8.8','not-an-ip','193.99.144.80:443'])assert.equal(visitorIp(headers(ip),env),null,ip);
});
test('only coarse finite European coordinates and bounded city text are returned, never the IP or original record',()=>{
 const record={location:{latitude:48.12345,longitude:11.98765},city:{names:{de:'München',en:'Munich'}},traits:{ip_address:'193.99.144.80'}};
 assert.deepEqual(coarseVisitorLocation(record),{lat:48.12,lon:11.99,city:'München'});
 assert.equal(coarseVisitorLocation(null),null);
 for(const location of [{latitude:NaN,longitude:11},{latitude:48,longitude:Infinity},{latitude:0,longitude:11},{latitude:48,longitude:90}])assert.equal(coarseVisitorLocation({location}),null);
 assert.equal(coarseVisitorLocation({...record,city:{names:{en:'<City>\n'+ 'x'.repeat(200)}}}).city.length,100);
});
