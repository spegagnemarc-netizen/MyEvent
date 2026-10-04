import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const preview=readFileSync(new URL('./accommodation-preview.html',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../js/accommodation-search-runtime.js',import.meta.url),'utf8');
function fixture(){
 const dom=new JSDOM(preview,{url:'https://preview.example.test',runScripts:'outside-only'});
 const w=dom.window;let timeout,cleared=false;
 w.setTimeout=fn=>{timeout=fn;return 1;};w.clearTimeout=()=>{cleared=true;};
 w.fetch=()=>{throw Error('The string did not match the expected pattern.');};
 w.eval(runtime);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,expire:()=>timeout(),cleared:()=>cleared};
}
test('official snippet and single pre-DOMContentLoaded script preserve exact affiliate IDs',()=>{
 for(const source of [html,preview]){
  const dom=new JSDOM(source),d=dom.window.document;
  try{
   const widget=d.querySelector('#m58AccommodationHotelsWidget');
   assert.deepEqual({...widget.dataset},{widget:'search',program:'fr-hcom',lobs:'stays',network:'pz',camref:'1110lR6fx',pubref:'myevent-hebergement'});
   const scripts=d.querySelectorAll('script.eg-widgets-script');assert.equal(scripts.length,1);
   assert.equal(scripts[0].src,'https://creator.expediagroup.com/products/widgets/assets/eg-widgets.js');
   assert(!scripts[0].hasAttribute('async'));assert(!scripts[0].hasAttribute('defer'));
   assert(source.indexOf('m58AccommodationHotelsWidget')<source.indexOf('eg-widgets-script'));
   assert.equal(d.querySelector('#m58AccommodationSearchLaunch'),null);
   assert.equal(d.querySelector('#m58AccommodationDestination'),null);
   assert.match(widget.parentElement.textContent,/Lien affilié/);
  }finally{dom.window.close();}
 }
});
test('legacy search and repeated opening never call old API or duplicate widget script',()=>{
 const {dom,w}=fixture();try{
  w.document.getElementById('m58AccommodationForm').classList.remove('hidden');
  for(let i=0;i<4;i++)w.v58SearchAccommodation();
  assert(!w.document.getElementById('m58AccommodationSearchBox').classList.contains('hidden'));
  assert(w.document.getElementById('m58AccommodationForm').classList.contains('hidden'));
  assert.equal(w.document.querySelectorAll('script.eg-widgets-script').length,1);
  assert(!runtime.includes('/api/search-accommodation'));
 }finally{dom.window.close();}
});
test('script failure is specific, visible, retryable and keeps manual planning intact',()=>{
 const {dom,w,cleared}=fixture();try{
  w.MyEventAccommodationWidget.fail();const d=w.document;
  assert.match(d.getElementById('m58AccommodationWidgetStatus').textContent,/n’a pas pu charger/);
  assert(!d.getElementById('m58AccommodationWidgetRetry').classList.contains('hidden'));
  assert(d.getElementById('m58AccommodationManualName'));assert(d.getElementById('m58AccommodationSaveBtn'));
  assert(cleared());assert(!runtime.includes('unhandledrejection'));assert(!runtime.includes("addEventListener('error'"));
 }finally{dom.window.close();}
});
test('slow iframe reports failure; only the matching official frame can recover ready state',async()=>{
 const {dom,w,expire,cleared}=fixture();try{
  const d=w.document,widget=d.getElementById('m58AccommodationHotelsWidget');
  widget.setAttribute('data-instance','fixture');const frame=d.createElement('iframe');widget.append(frame);
  await Promise.resolve();assert.equal(frame.title,'Recherche Hotels.com France');
  expire();const message=d.getElementById('m58AccommodationWidgetStatus');assert.equal(message.hidden,false);
  const data={type:'eg-widget/resize',meta:{instance:'fixture'},payload:{frame:{style:{width:'375px',height:'420px'}}}};
  for(const overrides of [{origin:'https://evil.test'},{source:w},{data:{...data,meta:{instance:'other'}}},{data:{...data,type:'other'}}]){
   w.dispatchEvent(new w.MessageEvent('message',{origin:'https://creator.expediagroup.com',source:frame.contentWindow,data,...overrides}));assert.equal(message.hidden,false);
  }
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://creator.expediagroup.com',source:frame.contentWindow,data}));
  assert.equal(message.hidden,true);assert(cleared());w.MyEventAccommodationWidget.fail();assert.equal(message.hidden,true);
  assert(d.getElementById('m58AccommodationWidgetRetry').classList.contains('hidden'));
 }finally{dom.window.close();}
});
test('reevaluating our integration does not install a second setup or swallow unrelated errors',()=>{
 const {dom,w}=fixture();try{
  const integration=w.MyEventAccommodationWidget;w.eval(runtime);assert.equal(w.MyEventAccommodationWidget,integration);
  let observed=false;w.addEventListener('error',e=>{observed=!e.defaultPrevented;});
  w.dispatchEvent(new w.ErrorEvent('error',{message:'Unrelated module error',cancelable:true}));assert(observed);
 }finally{dom.window.close();}
});
