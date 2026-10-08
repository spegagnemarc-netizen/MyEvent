import test from 'node:test';import assert from 'node:assert/strict';
import {cropForRatio,pinchZoom} from '../src/camera/geometry.mjs';
import {validateLens,requireCapabilities} from '../src/effects/policy.mjs';
import {renderColorFrame,landmarksForFrame,colorFilters} from '../src/effects/color-pipeline.mjs';
test('portrait ratios crop within bounds without claiming fabricated sensor zoom',()=>{
  for(const [w,h] of [[1920,1080],[1080,1920],[4032,3024]])for(const ratio of ['4:3','1:1','9:16']){
    const c=cropForRatio(w,h,ratio);assert.ok(c.width+c.originX<=w);assert.ok(c.height+c.originY<=h);assert.ok(c.width>0&&c.height>0);
  }
  assert.throws(()=>cropForRatio(0,100,'4:3'));assert.throws(()=>cropForRatio(100,100,'fake'));
  assert.equal(pinchZoom(.5,200,100),.75);assert.equal(pinchZoom(0,1,100),0);assert.equal(pinchZoom(1,1000,1),1);
});
const lens=()=>({schemaVersion:1,id:'wedding-glasses',label:'Lunettes mariage',tracking:'face',requires:['faceLandmarks','overlays2D','composedPhoto'],assets:[{file:'glasses.png',sha256:'a'.repeat(64)}]});
test('manifest rejects remote/path assets, missing composition and unsupported capabilities',()=>{
  assert.equal(validateLens(lens()).id,'wedding-glasses');
  for(const asset of ['../glasses.png','https://external.test/x.glb','script.js'])assert.throws(()=>validateLens({...lens(),assets:[{file:asset,sha256:'a'.repeat(64)}]}));
  assert.throws(()=>validateLens({...lens(),requires:['faceLandmarks']}));
  assert.throws(()=>requireCapabilities(lens(),{faceLandmarks:false,overlays2D:true,composedPhoto:true}));
  assert.doesNotThrow(()=>requireCapabilities(lens(),{faceLandmarks:true,overlays2D:true,composedPhoto:true}));
});
test('reference pixel filters modify real pixels, preserve alpha and use deterministic preview/export grain',()=>{
  const input=new Uint8ClampedArray([220,80,40,255,10,200,140,128]);
  assert.deepEqual(renderColorFrame(input,'original'),input);
  const gray=renderColorFrame(input,'monochrome');assert.equal(gray[0],gray[1]);assert.equal(gray[1],gray[2]);
  for(const filter of colorFilters){const output=renderColorFrame(input,filter,27);assert.equal(output[3],255);assert.equal(output[7],128);assert.deepEqual(output,renderColorFrame(input,filter,27));}
  assert.equal(input[0],220);assert.notDeepEqual(renderColorFrame(input,'warm'),input);assert.throws(()=>renderColorFrame(input,'fake'));
});
test('foreign, stale, low confidence and malformed landmarks never decorate a different frame',()=>{
  const frame={id:'frame-1',timestampMs:1000},marks={frameId:'frame-1',timestampMs:1000,confidence:.9,coordinateSpace:'normalized-oriented-unmirrored',points:[{x:.5,y:.5}]};
  assert.equal(landmarksForFrame(frame,marks),marks);
  for(const invalid of [{...marks,frameId:'frame-2'},{...marks,timestampMs:1},{...marks,confidence:.1},{...marks,points:[{x:NaN,y:1}]}])assert.equal(landmarksForFrame(frame,invalid),null);
});
