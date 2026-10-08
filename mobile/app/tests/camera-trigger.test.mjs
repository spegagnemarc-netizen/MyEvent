import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {cameraTriggerScript,cameraTriggerMessage,openWebCameraScript,releaseCameraTriggerScript} from '../src/bridge/camera-trigger.mjs';
import {importPhotoScript} from '../src/bridge/protocol.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom'),origin='https://preview.test',token='native-session-123';
const photo=Buffer.from([255,216,1,2,255,217]).toString('base64');
function fixture(native=true){
  const dom=new JSDOM('<button id="socialBottomCreate"><span>Photo</span></button><button id="storyUseCamera">Story</button><div id="myeventCameraModal"></div><input id="cameraFileInput" type="file">',{url:origin,runScripts:'outside-only'});
  const w=dom.window,messages=[];let webOpens=0,imports=0,story=false;
  if(native)w.ReactNativeWebView={postMessage:data=>messages.push(JSON.parse(data))};
  w.document.getElementById('socialBottomCreate').addEventListener('click',()=>webOpens++);
  w.document.getElementById('storyUseCamera').onclick=()=>{story=true;w.document.getElementById('socialBottomCreate').click();};
  w.document.getElementById('myeventCameraModal').addEventListener('camera-closed',()=>{story=false;});
  const input=w.document.getElementById('cameraFileInput');Object.defineProperty(input,'files',{writable:true,value:[]});
  w.DataTransfer=class{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}};input.onchange=()=>imports++;
  return {dom,w,messages,counts:()=>({webOpens,imports,story}),inject:()=>w.eval(cameraTriggerScript(origin,token))};
}
test('normal home button opens native once; nested icon and double clicks do not open web',()=>{
  const f=fixture();f.inject();assert.equal(f.messages[0].available,true);
  f.w.document.querySelector('#socialBottomCreate span').click();f.w.document.getElementById('socialBottomCreate').click();
  assert.equal(f.messages.filter(m=>m.type==='open-native-camera').length,1);assert.equal(f.counts().webOpens,0);f.dom.window.close();
});
test('photo return bypasses interception and reuses web import without reopening native',()=>{
  const f=fixture();f.inject();f.w.document.getElementById('socialBottomCreate').click();
  f.w.eval(importPhotoScript(photo,origin,'photo-1'));
  assert.deepEqual(f.counts(),{webOpens:1,imports:1,story:false});assert.equal(f.messages.filter(m=>m.type==='open-native-camera').length,1);
  f.dom.window.close();
});
test('Story routing survives capture/import; cancellation resets Story and unlocks the next capture',()=>{
  const f=fixture();f.inject();f.w.document.getElementById('storyUseCamera').click();f.w.eval(importPhotoScript(photo,origin,'story-photo'));
  assert.equal(f.counts().story,true);assert.equal(f.counts().imports,1);
  f.w.eval(releaseCameraTriggerScript(origin));assert.equal(f.counts().story,false);
  f.w.document.getElementById('socialBottomCreate').click();assert.equal(f.messages.filter(m=>m.type==='open-native-camera').length,2);f.dom.window.close();
});
test('explicit web fallback bypasses native; reinjection does not duplicate event listeners',()=>{
  const f=fixture();f.inject();f.inject();f.w.eval(openWebCameraScript(origin));assert.equal(f.counts().webOpens,1);
  f.w.document.getElementById('socialBottomCreate').click();assert.equal(f.messages.filter(m=>m.type==='open-native-camera').length,1);f.dom.window.close();
});
test('normal browser and foreign origins keep the original web camera',()=>{
  const f=fixture(false);f.inject();f.w.document.getElementById('socialBottomCreate').click();assert.equal(f.counts().webOpens,1);
  assert.equal(f.w.__myeventMobileCamera,undefined);f.dom.window.close();
  const other=fixture();other.w.eval(cameraTriggerScript('https://other.test',token));other.w.document.getElementById('socialBottomCreate').click();assert.equal(other.counts().webOpens,1);other.dom.window.close();
});
test('bridge availability follows late-mounted/replaced buttons',async()=>{
  const f=fixture();f.w.document.getElementById('socialBottomCreate').remove();f.inject();assert.equal(f.messages[0].available,false);
  const button=f.w.document.createElement('button');button.id='socialBottomCreate';f.w.document.body.append(button);
  await new Promise(r=>setTimeout(r,0));assert.equal(f.messages.at(-1).available,true);button.click();assert.equal(f.messages.at(-1).type,'open-native-camera');f.dom.window.close();
});
test('native boundary rejects wrong origin, credentials, old tokens and unknown/malformed commands',()=>{
  const message=JSON.stringify({version:1,type:'open-native-camera',token});
  assert.equal(cameraTriggerMessage(message,origin,origin,token).type,'open-native-camera');
  for(const url of ['https://evil.test','https://u:p@preview.test','http://preview.test'])assert.equal(cameraTriggerMessage(message,url,origin,token),null);
  assert.equal(cameraTriggerMessage(message,origin,origin,'next-session'),null);
  for(const raw of ['null','bad',JSON.stringify({version:1,type:'upload',token})])assert.equal(cameraTriggerMessage(raw,origin,origin,token),null);
});
