const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const {prepare}=require('../public-discovery/prepare-vercel-preview.cjs');
test('Preview package uploads exactly public HTML and its security headers, no server, secret or private source',()=>{
 const bundle=prepare();assert.deepEqual(bundle.files.map(x=>x.file),['index.html','vercel.json']);assert(bundle.files[0].data.includes('data-hosting="static-preview"'));assert.equal(bundle.config.framework,null);assert.equal(bundle.config.buildCommand,null);assert.equal(bundle.config.installCommand,null);
 const headers=Object.fromEntries(bundle.config.headers[0].headers.map(x=>[x.key,x.value]));assert(headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));assert.equal(headers['Cross-Origin-Opener-Policy'],'same-origin');assert.equal(headers['Referrer-Policy'],'no-referrer');
});
test('hosted static Preview does not call APIs or open SSE; real advertising remains absent',async()=>{
 let requests=0;const html=prepare().files[0].data,dom=new JSDOM(html,{url:'https://isolated-preview.vercel.app',runScripts:'dangerously',beforeParse(w){w.EventSource=class{constructor(){requests++;}};w.fetch=()=>{requests++;throw Error('No network permitted');};w.IntersectionObserver=class{observe(){}disconnect(){}unobserve(){}};}});
 try{assert.equal(dom.window.document.querySelectorAll('.card').length,12);assert.equal(dom.window.document.querySelectorAll('.simulation').length,0);assert.equal(requests,0);assert.match(dom.window.document.getElementById('demoStatus').textContent,/administration non raccordée/);assert(!dom.window.document.querySelector('script[src]'));}finally{dom.window.close();}
});
