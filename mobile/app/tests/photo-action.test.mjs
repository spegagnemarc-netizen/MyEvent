import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {photoActionScript} from '../src/bridge/photo-action.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom'),origin='https://preview.test';
const photo=Buffer.from([255,216,1,2,255,217]).toString('base64');
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(){
 const dom=new JSDOM('<button id="socialBottomCreate"></button><div id="myeventCameraModal"><p id="cameraPlaceholder"></p></div><input id="cameraFileInput" type="file"><button id="cameraPublishBtn"></button><button id="cameraEventBtn"></button><button id="cameraCloseBtn"></button>',{url:origin,runScripts:'outside-only'});
 const w=dom.window,messages=[],modal=w.document.getElementById('myeventCameraModal');let publishes=0,events=0,webOpens=0;
 const list=w.document.createElement('div');list.id='eventList';list.innerHTML='<div class="eventCard" data-event-id="test-event"></div>';w.document.body.append(list);
 w.ReactNativeWebView={postMessage:data=>messages.push(JSON.parse(data))};w.alert=()=>{};
 w.DataTransfer=class{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}};
 const input=w.document.getElementById('cameraFileInput');Object.defineProperty(input,'files',{writable:true,value:[]});
 input.onchange=()=>setTimeout(()=>modal.dispatchEvent(new w.Event('camera-preview-ready')),0);
 w.document.getElementById('socialBottomCreate').onclick=()=>webOpens++;
 const close=()=>{modal.classList.remove('open');modal.dispatchEvent(new w.Event('camera-closed'));};
 w.document.getElementById('cameraCloseBtn').onclick=close;
 w.document.getElementById('cameraPublishBtn').onclick=()=>{publishes++;};
 w.document.getElementById('cameraEventBtn').onclick=()=>{events++;close();};
 return {w,dom,messages,modal,close,counts:()=>({publishes,events,webOpens}),run:(action,id='test')=>w.eval(photoActionScript(photo,origin,id,action))};
}
test('native publication keeps web camera hidden and acknowledges only persistence completion; retries cannot duplicate',async()=>{
 const f=fixture();try{f.run('publish');await tick();assert.equal(f.modal.style.display,'none');assert.equal(f.counts().webOpens,0);assert.equal(f.counts().publishes,1);assert.equal(f.messages.some(m=>m.type==='action-completed'),false);
 f.run('publish');assert.equal(f.counts().publishes,1);f.close();assert.equal(f.messages.at(-1).type,'action-completed');assert.equal(f.modal.style.display,'');f.run('publish');assert.equal(f.counts().publishes,1);assert.equal(f.messages.at(-1).type,'action-completed');
 }finally{f.dom.window.close();}
});
test('event action reuses destination selector without claiming that attachment is already saved',async()=>{
 const f=fixture();try{f.run('event');await tick();assert.deepEqual(f.counts(),{publishes:0,events:1,webOpens:0});assert.equal(f.messages.at(-1).type,'action-completed');assert.equal(f.modal.classList.contains('open'),false);}finally{f.dom.window.close();}
});
test('server publication error keeps native photo retryable and restores hidden web state',async()=>{
 const f=fixture();try{f.run('publish');await tick();f.w.document.getElementById('cameraPlaceholder').textContent='Publication impossible : RLS denied';await tick();assert.equal(f.messages.at(-1).type,'action-failed');assert.match(f.messages.at(-1).error,/RLS denied/);assert.equal(f.modal.style.display,'');f.run('publish');await tick();assert.equal(f.counts().publishes,2);}finally{f.dom.window.close();}
});
test('unknown action and foreign origin cannot trigger publication',()=>{
 const f=fixture();try{assert.throws(()=>f.run('delete'));f.w.eval(photoActionScript(photo,'https://other.test','test','publish'));assert.equal(f.counts().publishes,0);assert.equal(f.messages.length,0);}finally{f.dom.window.close();}
});
test('no event means no attachment request and native photo remains available',()=>{const f=fixture();try{f.w.document.getElementById('eventList').replaceChildren();f.run('event');assert.equal(f.messages.at(-1).type,'action-failed');assert.match(f.messages.at(-1).error,/Aucun événement/);assert.equal(f.counts().events,0);}finally{f.dom.window.close();}});
