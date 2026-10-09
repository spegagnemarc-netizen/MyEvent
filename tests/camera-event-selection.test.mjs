import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom'),source=readFileSync(new URL('../js/home-social-runtime.js',import.meta.url),'utf8');
const start=source.indexOf('  function openCameraEventDestination(){'),end=source.indexOf('  function renderCameraFeedPost',start);
test('choosing an event never saves until explicit confirmation; failure allows retry',async()=>{
 const dom=new JSDOM('<button id="cameraEventBtn"></button><div id="eventList"><div class="eventCard" data-event-id="A"><div class="eventCardTopInfo"><b>Anniversaire</b></div></div><div class="eventCard" data-event-id="B"><div class="eventCardTopInfo"><b>Sortie</b></div></div></div>',{runScripts:'outside-only'}),w=dom.window,alerts=[],saved=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.alert=s=>alerts.push(s);w.myeventAttachCameraPhoto=async(id,photo)=>{saved.push({id,photo});if(saved.length===1)throw Error('storage unavailable');};w.selectEvent=async id=>{w.selected=id;};
 w.eval(`const $s=id=>document.getElementById(id);let myeventCapturedDataUrl='data:image/jpeg;base64,test';let cameraVideoFile=null;let myeventCameraStream=null;function closeMyEventCamera(){window.cameraClosed=true;}\n`+source.slice(start,end));
 w.document.getElementById('cameraEventBtn').click();const dialog=w.document.querySelector('dialog'),select=dialog.querySelector('select'),add=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Ajouter à cet événement');assert.ok(add.disabled);select.value='B';select.dispatchEvent(new w.Event('change'));assert.equal(saved.length,0);
 add.click();await new Promise(r=>setImmediate(r));assert.equal(saved[0].id,'B');assert.match(dialog.textContent,/storage unavailable/);assert.ok(!add.disabled);
 add.click();await new Promise(r=>setImmediate(r));assert.equal(saved.length,2);assert.equal(w.selected,'B');assert.equal(w.cameraClosed,true);assert.equal(w.document.querySelector('dialog'),null);assert.match(alerts[0],/Sortie/);dom.window.close();
});
