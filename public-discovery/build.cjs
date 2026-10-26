'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const items=JSON.parse(read('src/catalog.json'));
const keys=['id','title','category','place','moment','description','tone','symbol'].sort();
const tones=new Set(['sage','peach','lilac','blue','rose','night']);
if(items.length!==12||new Set(items.map(x=>x.id)).size!==items.length)throw Error('Expected 12 distinct fictional examples.');
for(const item of items){
 if(Object.keys(item).sort().join()!==keys.join()||Object.values(item).some(v=>typeof v!=='string'||v.length>300)||!item.id.startsWith('demo-')||!tones.has(item.tone))throw Error('Public catalog allowlist violation.');
}
const pure=name=>fs.readFileSync(path.join(root,'..','js',name),'utf8').replace(/\bexport /g,'');
const script="\n(()=>{\n'use strict';\n"+pure('automatic-ads-policy.mjs')+'\n'+pure('ads-consent.mjs')+'\nconst ITEMS='+JSON.stringify(items).replace(/</g,'\\u003c')+';\n'+read('src/app.js')+'\n})();\n';
const styles='\n'+read('src/styles.css')+'\n';
const hash=text=>"'sha256-"+crypto.createHash('sha256').update(text).digest('base64')+"'";
const csp=["default-src 'none'",'script-src '+hash(script),'style-src '+hash(styles),"img-src 'none'","connect-src 'self'","frame-src 'none'","frame-ancestors 'none'","worker-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'"].join('; ');
const html=read('src/page.html').replace('__STYLES__',styles).replace('__SCRIPT__',script).replace('__CSP__',csp.split('; ').filter(d=>!d.startsWith('frame-ancestors')).join('; '));
fs.writeFileSync(path.join(root,'index.html'),html);
fs.writeFileSync(path.join(root,'headers.json'),JSON.stringify({'Content-Security-Policy':csp,'Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','Origin-Agent-Cluster':'?1','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cache-Control':'no-store'},null,2)+'\n');
console.log('Built isolated TEST discovery: 12 fictional entries; zero external resources.');
