import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {trustedNavigation,validatePhoto,importPhotoScript} from '../src/bridge/protocol.mjs';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),origin='https://preview.test';
const photo=Buffer.from([255,216,1,2,255,217]).toString('base64');
test('only the exact configured HTTPS origin can receive a native photo',()=>{
  assert.ok(trustedNavigation(origin+'/index.html',origin));
  for(const url of ['http://preview.test','https://preview.test.evil.test','https://u:p@preview.test','file:///tmp/photo','https://preview.test:444'])assert.equal(trustedNavigation(url,origin),false);
});
test('invalid and oversized media are refused before JavaScript injection',()=>{
  assert.doesNotThrow(()=>validatePhoto(photo));for(const value of ['<script>',Buffer.from('fake').toString('base64'),'A'.repeat(5600000)])assert.throws(()=>validatePhoto(value));
});
test('photo injection imports a local file without publishing and acknowledges once',()=>{
  const dom=new JSDOM('<button id="socialBottomCreate"></button><input type="file" id="cameraFileInput">',{url:origin,runScripts:'outside-only'}),w=dom.window,calls=[];
  Object.defineProperty(w.document.getElementById('cameraFileInput'),'files',{value:[],writable:true});
  w.DataTransfer=class{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}};
  w.ReactNativeWebView={postMessage:data=>calls.push(JSON.parse(data))};
  let opened=0,imported=0;w.document.getElementById('socialBottomCreate').onclick=()=>opened++;
  w.document.getElementById('cameraFileInput').onchange=()=>imported++;
  w.eval(importPhotoScript(photo,origin,'photo-1'));assert.equal(opened,1);assert.equal(imported,1);assert.deepEqual(calls,[{version:1,type:'imported',id:'photo-1'}]);
  assert.equal(w.document.getElementById('cameraFileInput').files[0].type,'image/jpeg');
  w.eval(importPhotoScript(photo,'https://other.test','photo-2'));assert.equal(imported,1);dom.window.close();
});
