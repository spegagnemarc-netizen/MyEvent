import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require = createRequire(import.meta.url), {JSDOM} = require('jsdom');
const root = new URL('../../', import.meta.url);
const source = readFileSync(new URL('mobile/bridge/native-camera.js', root), 'utf8');
function setup(reply, native = true) {
  const dom = new JSDOM('<button id="socialBottomCreate"></button><button id="cameraGalleryBtn"></button><video id="myeventCameraVideo"></video><input id="cameraFileInput" type="file"><p id="cameraHint"></p>', {url:'https://preview.test',runScripts:'outside-only'});
  const w = dom.window, calls = [], files = [], tracks = [];
  const video = w.document.getElementById('myeventCameraVideo');
  video.srcObject = {getTracks:()=>[{stop:()=>tracks.push('stopped')}]};
  const input = w.document.getElementById('cameraFileInput');
  Object.defineProperty(input,'files',{value:[],writable:true});
  w.DataTransfer = class {constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}};
  w.document.getElementById('socialBottomCreate').onclick = ()=>calls.push('open-web');
  input.onchange = ()=>files.push(...input.files);
  if(native) w.webkit={messageHandlers:{myeventCamera:{postMessage:async body=>{calls.push(body);return reply()}}}};
  w.eval(source); w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {dom,w,calls,files,tracks};
}
const jpeg = {version:1,mime:'image/jpeg',base64:Buffer.from([255,216,1,2,255,217]).toString('base64')};
test('web without a native handler remains untouched',()=>{
  const f=setup(()=>jpeg,false);
  assert.equal(f.w.myeventNativeCamera,undefined);assert.equal(f.w.document.getElementById('cameraNativeBtn'),null);assert.deepEqual(f.tracks,[]);f.dom.window.close();
});
test('native photo stops the web camera and reaches existing import only, with no publication',async()=>{
  const f=setup(()=>jpeg);
  await f.w.myeventNativeCamera.importPhoto();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[{version:1,action:'capturePhoto'},'open-web']);
  assert.deepEqual(f.tracks,['stopped']);assert.equal(f.files.length,1);assert.equal(f.files[0].type,'image/jpeg');assert.equal(f.files[0].size,6);
  f.w.eval(source);assert.equal(f.w.document.querySelectorAll('#cameraNativeBtn').length,1);f.dom.window.close();
});
test('cancel returns to the existing web camera without importing a photo',async()=>{
  const f=setup(()=>({version:1,cancelled:true}));await f.w.myeventNativeCamera.importPhoto();assert.equal(f.files.length,0);assert.equal(f.calls.at(-1),'open-web');f.dom.window.close();
});
test('a second request is refused and cancellation releases the request lock',async()=>{
  let resolve;const f=setup(()=>new Promise(r=>resolve=r));const first=f.w.myeventNativeCamera.capturePhoto();
  await assert.rejects(f.w.myeventNativeCamera.capturePhoto(),/déjà/);resolve({version:1,cancelled:true});assert.equal(await first,null);f.dom.window.close();
});
test('invalid MIME, bytes, encoding, version and excessive payloads cannot be imported',async()=>{
  for(const result of [{...jpeg,mime:'text/html'},{...jpeg,version:2},{...jpeg,base64:'%%%<script>'},{...jpeg,base64:Buffer.from('fake').toString('base64')},{...jpeg,base64:'A'.repeat(5600000)}]){
    const f=setup(()=>result);await assert.rejects(f.w.myeventNativeCamera.importPhoto());assert.equal(f.files.length,0);f.dom.window.close();
  }
});
test('handler rejection does not permanently lock future requests',async()=>{
  let count=0;const f=setup(()=>{if(!count++)throw new Error('Permission refusée');return jpeg});
  await assert.rejects(f.w.myeventNativeCamera.capturePhoto(),/Permission/);assert.ok(await f.w.myeventNativeCamera.capturePhoto());f.dom.window.close();
});
test('importing the mobile foundation preserves its original Swift and legacy bridge sources',()=>{
  assert.equal(execFileSync('git',['diff','f2f5e861c364331c5cad81fabaa2d9511ff6d4dd','--','mobile/ios','mobile/bridge'],{cwd:root,encoding:'utf8'}),'');
});
