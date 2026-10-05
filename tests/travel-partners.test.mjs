import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../js/accommodation-search-runtime.js',import.meta.url),'utf8');
function fixture(){const dom=new JSDOM(html,{runScripts:'outside-only'});dom.window.setTimeout=()=>1;dom.window.clearTimeout=()=>{};dom.window.eval(runtime);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));return dom;}
test('four official placements preserve affiliate IDs and a single script',()=>{
 const dom=new JSDOM(html),d=dom.window.document;
 const expected=[['m58AccommodationHotelsWidget','fr-hcom','stays','1110lR6fx','myevent-hebergement'],['m58AccommodationExpediaWidget','fr-expedia','stays','1011l6tumI','myevent-expedia'],['m58AccommodationAbritelWidget','abritel','stays','1100l6v4qo','myevent-abritel'],['m58TransportExpediaWidget','fr-expedia','flights','1011l6tumI','myevent-expedia']];
 for(const [id,program,lobs,camref,pubref] of expected){const w=d.getElementById(id);assert.equal(w.dataset.program,program);assert.equal(w.dataset.lobs,lobs);assert.equal(w.dataset.camref,camref);assert.equal(w.dataset.pubref,pubref);assert.equal(w.dataset.network,'pz');}
 assert.equal(d.querySelectorAll('script.eg-widgets-script').length,1);dom.window.close();
});
test('partner selection only displays one accommodation widget without recreating entered frames',()=>{
 const dom=fixture(),d=dom.window.document;
 for(const button of d.querySelectorAll('[data-partner-select]')){button.click();assert.equal(d.querySelectorAll('#m58AccommodationSearchBox .myeventEgSlot:not([hidden])').length,1);assert.equal(d.getElementById(button.dataset.partnerSelect).hidden,false);assert.equal(d.querySelectorAll('[data-partner-select][aria-pressed="true"]').length,1);}
 assert.equal(d.getElementById('m58TransportExpediaWidget').closest('.myeventEgSlot').hidden,false);dom.window.close();
});
test('per-widget failure and authenticated recovery do not change another partner state',()=>{
 const dom=fixture(),w=dom.window,d=w.document;w.MyEventAccommodationWidget.fail();
 const widget=d.getElementById('m58AccommodationAbritelWidget'),slot=widget.parentElement,frame=d.createElement('iframe');widget.dataset.instance='abritel-test';widget.append(frame);
 const data={type:'eg-widget/resize',meta:{instance:'abritel-test'}};
 w.dispatchEvent(new w.MessageEvent('message',{origin:'https://evil.test',source:frame.contentWindow,data}));assert.equal(slot.querySelector('.myeventEgStatus').hidden,false);
 w.dispatchEvent(new w.MessageEvent('message',{origin:'https://creator.expediagroup.com',source:frame.contentWindow,data}));assert.equal(slot.querySelector('.myeventEgStatus').hidden,true);
 assert.equal(d.querySelector('#m58AccommodationExpediaSlot .myeventEgStatus').hidden,false);assert.equal(d.querySelectorAll('.myeventEgRetry:not([hidden])').length,3);dom.window.close();
});
test('existing Transport and Omio, manual accommodation and other scripts remain unchanged',()=>{
 const base=execFileSync('git',['show','d876c6581c0d40d10ec697191916c91395a99b1a:index.html'],{encoding:'utf8'});
 const oldDom=new JSDOM(base),newDom=new JSDOM(html);
 for(const id of ['myeventOmioSection','m58TransportForm','m58TransportSearchBox','m58AccommodationForm'])assert.equal(newDom.window.document.getElementById(id).outerHTML,oldDom.window.document.getElementById(id).outerHTML,id);
 assert.equal(execFileSync('git',['diff','dd0d50241a4ec05ea760c92e153cde012af71c0d','--','server','lib','supabase','vercel.json',':(exclude)supabase/migrations/202610050001_personal_reservations.sql',':(exclude)supabase/migrations/202610050002_admin_v3_dashboard_reservations.sql',':(exclude)supabase/admin/production-readiness-v3.sql'],{encoding:'utf8'}),'');
 const searchBase=execFileSync('git',['show','dd0d50241a4ec05ea760c92e153cde012af71c0d:api/search-places.js'],{encoding:'utf8'});
 // Explorer needs explicit accuracy metadata. Existing search/affiliate behavior is unchanged.
 assert.equal(readFileSync(new URL('../api/search-places.js',import.meta.url),'utf8').replace(',locationApproximate:!!location.approximate','').replaceAll('\r\n','\n'),searchBase.replaceAll('\r\n','\n'));
 oldDom.window.close();newDom.window.close();
});
