import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
const {offerMailConfig,offerMailMessage,offerMailTransportOptions,deliverOfferNotification}=await import('../src/lib/offer-notification.ts');
const env={SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'sender@example.test',SMTP_PASSWORD:'test-only',OFFER_NOTIFICATION_FROM:'sender@example.test',OFFER_NOTIFICATION_TO:'receiver@example.test',OFFER_NOTIFICATION_ORIGIN:'https://portal.example.test',OFFER_NOTIFICATION_ENABLED:'true'};
test('mail configuration is disabled by default and rejects header injection, plain SMTP and wrong Netlify branch',()=>{
 assert.ok(offerMailConfig(env));assert.equal(offerMailConfig({...env,OFFER_NOTIFICATION_ENABLED:'false'}),null);
 for(const patch of [{SMTP_PASSWORD:''},{SMTP_PORT:'25'},{SMTP_SECURE:'false'},{OFFER_NOTIFICATION_TO:'ok@example.test\r\nBcc:bad@example.test'},{OFFER_NOTIFICATION_ORIGIN:'https://user:pass@example.test'},{NETLIFY:'true',BRANCH:'main'}])assert.equal(offerMailConfig({...env,...patch}),null);
 assert.ok(offerMailConfig({...env,NETLIFY:'true',BRANCH:'feature/portal-frontend'}));
});
test('587 is allowed only with mandatory STARTTLS and certificate verification; 465 remains implicit TLS',()=>{
 const config=offerMailConfig({...env,SMTP_PORT:'587',SMTP_SECURE:'false'});assert.ok(config);
 const options=offerMailTransportOptions(config);assert.equal(options.port,587);assert.equal(options.secure,false);assert.equal(options.requireTLS,true);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.tls.minVersion,'TLSv1.2');
 assert.equal(offerMailConfig({...env,SMTP_PORT:'587',SMTP_SECURE:'true'}),null);
 assert.equal(offerMailTransportOptions(offerMailConfig(env)).secure,true);
});
test('a server without STARTTLS never receives AUTH credentials',async()=>{
 const {createServer}=await import('node:net');const {default:nodemailer}=await import('nodemailer');const commands=[];const sockets=new Set();
 const server=createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 test.invalid ESMTP\r\n');let buffer='';socket.on('data',data=>{buffer+=data;while(buffer.includes('\r\n')){const at=buffer.indexOf('\r\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+2);const verb=line.split(' ')[0];commands.push(verb);if(verb==='EHLO')socket.write('250-test.invalid\r\n250 AUTH PLAIN LOGIN\r\n');else socket.write('500 STARTTLS unavailable\r\n');}});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const transport=nodemailer.createTransport({...offerMailTransportOptions(offerMailConfig({...env,SMTP_PORT:'587',SMTP_SECURE:'false'})),host:'127.0.0.1',port:server.address().port});
 try{await assert.rejects(transport.verify());assert.ok(commands.includes('STARTTLS'));assert.equal(commands.includes('AUTH'),false);}finally{transport.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});
test('notification contains only stable admin link and ID, without attachments or customer-controlled headers',()=>{const key=crypto.randomUUID(),m=offerMailMessage(offerMailConfig(env),key);assert.equal(m.to,env.OFFER_NOTIFICATION_TO);assert.match(m.text,new RegExp('/admin/werbung/'+key));assert.equal(m.attachments,undefined);assert.throws(()=>offerMailMessage(offerMailConfig(env),'bad\r\nBcc: bad@example.test'));});
test('duplicate claim never sends; SMTP rejection persists failed; receipt error remains explicit',async()=>{
 let sends=0;assert.equal(await deliverOfferNotification({rpc:async()=>({data:null})},crypto.randomUUID(),async()=>{sends++;return true}),'duplicate');assert.equal(sends,0);
 const calls=[];const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='claim_offer_request_mail'?'claim-token':null,error:null}}};
 assert.equal(await deliverOfferNotification(client,crypto.randomUUID(),async()=>{throw Error('private SMTP details')}),'failed');assert.equal(calls[1][1].p_accepted,false);
 calls.length=0;assert.equal(await deliverOfferNotification(client,crypto.randomUUID(),async()=>true),'accepted');assert.equal(calls[1][1].p_accepted,true);
 await assert.rejects(deliverOfferNotification({rpc:async()=>({error:{message:'db'}})},crypto.randomUUID(),async()=>true),/notification_claim_failed/);
});
