import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FaceEngine} from '../js/camera-face-engine.mjs';
import {drawAppearance} from '../js/camera-appearance-renderer.mjs';

function workerEnvironment(t,{delayBitmap=false}={}){
  const names=['Worker','OffscreenCanvas','createImageBitmap'],saved=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
  const messages=[],instances=[];let resolveBitmap,closedBitmaps=0;
  class FakeWorker {
    constructor(){instances.push(this);}
    postMessage(data){messages.push(data);if(data.type==='init')queueMicrotask(()=>this.onmessage({data:{id:data.id,ok:true}}));}
    respond(data){this.onmessage({data:{id:data.id,landmarks:[{x:.5,y:.5}]}});}
    terminate(){this.terminated=true;}
  }
  globalThis.Worker=FakeWorker;globalThis.OffscreenCanvas=class {};
  globalThis.createImageBitmap=()=>delayBitmap?new Promise(resolve=>resolveBitmap=resolve):Promise.resolve({close(){closedBitmaps++;}});
  t.after(()=>names.forEach((name,i)=>{if(saved[i])Object.defineProperty(globalThis,name,saved[i]);else delete globalThis[name];}));
  return {messages,instances,get bitmapClosed(){return closedBitmaps;},finishBitmap(){resolveBitmap({close(){closedBitmaps++;}});}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('live and still inference are serialized; closing rejects a pending request',async t=>{
  const env=workerEnvironment(t),engine=new FaceEngine();t.after(()=>engine.close());
  const live=engine.detect({},'VIDEO'),still=engine.detect({},'IMAGE');
  await flush();assert.equal(env.messages.filter(m=>m.type==='detect').length,1);
  env.instances[0].respond(env.messages.find(m=>m.type==='detect'));await live;await flush();
  const requests=env.messages.filter(m=>m.type==='detect');assert.deepEqual(requests.map(r=>r.mode),['VIDEO','IMAGE']);
  const rejection=assert.rejects(still,{name:'AbortError'});engine.close();await rejection;
  assert.equal(env.instances[0].terminated,true);assert.equal(engine.pending.size,0);assert.equal(engine.task,null);
});

test('closing during bitmap creation disposes late bitmap without sending it',async t=>{
  const env=workerEnvironment(t,{delayBitmap:true}),engine=new FaceEngine();
  const pending=engine.detect({});const rejection=assert.rejects(pending,{name:'AbortError'});
  await flush();engine.close();env.finishBitmap();await rejection;
  assert.equal(env.messages.filter(m=>m.type==='detect').length,0);assert.ok(env.bitmapClosed>=1);
});

test('no landmarks means no drawing; all effects scale with output resolution',()=>{
  function context(){const calls=[];return new Proxy({calls},{get(target,key){if(key in target)return target[key];return (...args)=>calls.push([key,...args]);},set(target,key,value){target[key]=value;return true;}});}
  const empty=context();drawAppearance(empty,null,{glasses:'round'},640,640);assert.equal(empty.calls.length,0);
  const points=Array.from({length:478},(_,i)=>({x:.4+(i%10)*.02,y:.3+(i%7)*.03}));points[33]={x:.3,y:.4};points[263]={x:.7,y:.45};
  for(const selection of [{glasses:'round'},{glasses:'sun'},{accessories:'stars'},{accessories:'crown'},{makeup:'rose'},{makeup:'coral'}]){
    const small=context(),large=context();drawAppearance(small,points,selection,400,600);drawAppearance(large,points,selection,800,1200);
    assert.ok(small.calls.length>2);assert.equal(small.calls.filter(c=>c[0]==='save').length,small.calls.filter(c=>c[0]==='restore').length);
    const coordinates=c=>c.calls.filter(call=>['moveTo','lineTo','translate'].includes(call[0]));
    assert.deepEqual(coordinates(large),coordinates(small).map(([method,x,y])=>[method,x*2,y*2]));
    assert.ok(small.calls.every(call=>call.slice(1).every(value=>typeof value!=='number'||Number.isFinite(value))));
  }
});

test('vendored resources match pinned SHA-256 manifest',async()=>{
  const root=new URL('../assets/vendor/mediapipe/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
  assert.equal(manifest.version,'0.10.21');assert.equal(manifest.modelVersion,1);
  for(const file of manifest.files){const bytes=await readFile(new URL(file.path,root));assert.equal(bytes.length,file.bytes,file.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);}
});
