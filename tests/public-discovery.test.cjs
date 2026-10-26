const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createServer,createControlChannel}=require('../public-discovery/server.cjs');
const root=path.join(__dirname,'../public-discovery');
test('public bundle contains only fictional allowlisted data and no external loader or private bridge',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),items=JSON.parse(fs.readFileSync(path.join(root,'src/catalog.json')));
 assert.equal(items.length,12);assert(items.every(x=>x.id.startsWith('demo-')));
 assert(!/<script[^>]+src=|<iframe|postMessage\s*\(|supabase\.co|access_token|service_role|adsbygoogle|googlesyndication|document\.domain/.test(html));
 const plan=JSON.parse(fs.readFileSync(path.join(root,'integration-plan.json')));assert.equal(plan.releaseEnabled,false);assert.equal(plan.publisherId,null);assert.equal(plan.iframeAdsAllowed,false);
});
test('built CSP hashes match the actual inline script/style and prohibit external connections and frames',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),headers=JSON.parse(fs.readFileSync(path.join(root,'headers.json'))),csp=headers['Content-Security-Policy'];
 for(const tag of ['script','style']){const content=html.match(new RegExp('<'+tag+'>([\\s\\S]*?)</'+tag+'>'))[1],hash=crypto.createHash('sha256').update(content).digest('base64');assert(csp.includes("'sha256-"+hash+"'"));}
 assert(csp.includes("connect-src 'self'"));assert(csp.includes("frame-src 'none'"));assert(csp.includes("frame-ancestors 'none'"));assert(!csp.includes('unsafe-inline'));assert.equal(headers['Cross-Origin-Opener-Policy'],'same-origin');assert.equal(headers['Referrer-Policy'],'no-referrer');
});
test('local public server rejects credentials, private routes, exfiltration query strings and mutation requests',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base);assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('access-control-allow-origin'),null);assert.equal(response.headers.get('x-frame-options'),'DENY');
  for(const [uri,options,status] of [['/api/private',{},404],['/ads.txt',{},404],['/?token=TEST_PRIVATE_MARKER',{},400],['/',{headers:{Authorization:'Bearer TEST_ONLY'}},400],['/',{headers:{Cookie:'private=TEST_ONLY'}},400],['/control-events',{method:'POST'},405]])assert.equal((await fetch(base+uri,options)).status,status);
  assert.deepEqual(await (await fetch(base+'/health')).json(),{status:'ok',environment:'local-test',adsEnabled:false,privateData:false});
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('operator suspension signal is server-only, immediate, minimal and cannot enable real ads',()=>{
 const channel=createControlChannel(),events=[];const unsubscribe=channel.subscribe(state=>events.push(state));channel.suspend();assert.deepEqual(events,[{adsEnabled:false,suspended:true}]);assert.equal(channel.state().adsEnabled,false);unsubscribe();
});
