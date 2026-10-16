import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../js/home-social-runtime.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('  let cameraPublishing=false;'),source.indexOf("  $s('cameraAttachEventBtn')?."));
function fixture({photo='data:image/jpeg;simulated',publish=async()=>({id:'simulated-post'}),renderFailure=false}={}){
 const w=new JSDOM('<div id="cameraMediaStatus"></div><p id="socialPostMsg"></p><p id="socialFeedPublishStatus" role="status"></p><button id="cameraPublishBtn">Publier</button>',{runScripts:'outside-only'}).window;
 const calls=[];w.myeventPublishCameraPost=publish;w.renderCameraFeedPost=()=>{calls.push('render');if(renderFailure)throw Error('Render failure');};w.closeMyEventCamera=()=>calls.push('close');
 w.eval('function $s(id){return document.getElementById(id)};let myeventCapturedDataUrl='+JSON.stringify(photo)+';'+handler);
 return{w,calls,button:w.document.getElementById('cameraPublishBtn'),status:w.document.getElementById('cameraMediaStatus')};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('unready photo has explicit feedback instead of a silent return',()=>{const f=fixture({photo:''});try{f.button.click();assert.match(f.status.textContent,/Photo non prête/);assert.equal(f.button.disabled,false);}finally{f.w.close();}});
test('storage error reports stage and safe code without reflecting secrets or provider URLs',async()=>{const f=fixture({publish:async(_photo,stage)=>{stage('stockage');throw {statusCode:'400',message:'Bucket not found https://secret.test/?token=do-not-display'};}});try{f.button.click();await flush();assert.match(f.status.textContent,/stockage · 400/);assert.match(f.status.textContent,/stockage photo TEST est absent/);assert.equal(f.status.getAttribute('role'),'alert');assert(!f.status.textContent.includes('do-not-display'));assert.equal(f.button.disabled,false);assert.equal(f.calls.length,0);}finally{f.w.close();}});
test('pending publication disables repeat clicks and reports database permission rejection',async()=>{let reject,calls=0;const f=fixture({publish:(_p,stage)=>{calls++;stage('enregistrement');return new Promise((_r,no)=>reject=no);}});try{f.button.click();f.button.click();assert.equal(calls,1);assert(f.button.disabled);assert.match(f.status.textContent,/Enregistrement/);reject({code:'42501',message:'new row violates row-level security'});await flush();assert.match(f.status.textContent,/permissions TEST/);assert(!f.button.disabled);assert.match(f.status.textContent,/photo est conservée/);}finally{f.w.close();}});
test('saved post does not depend on a subsequent signed-media refresh, even if local rendering fails',async()=>{const f=fixture({renderFailure:true});try{f.w.myeventLoadCameraPosts=()=>{throw Error('Must not be called after saving');};f.button.click();await flush();assert.deepEqual(f.calls,['render','close']);assert.match(f.w.document.getElementById('socialFeedPublishStatus').textContent,/Photo publiée/);assert(!f.status.textContent.includes('Publication impossible'));assert(!f.button.disabled);}finally{f.w.close();}});
