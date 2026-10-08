import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {handleAndroidBack} from '../src/bridge/android-back.mjs';
const require=createRequire(import.meta.url),configure=require('../app.config.js');
const config=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
test('Release has its own identity, logo and splash without enabling a development client',()=>{
 const previous=process.env.MYEVENT_BUILD_PROFILE;
 try{
  process.env.MYEVENT_BUILD_PROFILE='release';const result=configure({config});
  assert.equal(result.name,'MyEvent');assert.equal(result.android.package,'app.myevent.mobile');
  assert.equal(result.ios.bundleIdentifier,'app.myevent.mobile');assert.equal(result.updates.enabled,false);
  assert.equal(result.plugins.filter(p=>(Array.isArray(p)?p[0]:p)==='expo-splash-screen').length,1);
  const icon=readFileSync(new URL('../src/assets/app-icon.png',import.meta.url));
  assert.equal(icon.subarray(1,4).toString(),'PNG');assert.equal(icon.readUInt32BE(16),1024);assert.equal(icon.readUInt32BE(20),1024);
  delete process.env.MYEVENT_BUILD_PROFILE;assert.equal(configure({config}).android.package,'app.myevent.mobile.dev');
  const eas=JSON.parse(readFileSync(new URL('../eas.json',import.meta.url),'utf8'));
  assert.equal(eas.build['release-private'].developmentClient,false);
  assert.equal(eas.build['release-private'].android.withoutCredentials,true);
 }finally{if(previous===undefined)delete process.env.MYEVENT_BUILD_PROFILE;else process.env.MYEVENT_BUILD_PROFILE=previous;}
});
test('Android back protects a transfer, closes camera, navigates WebView and exits only at root',()=>{
 let closed=0,back=0;const input={cameraOpen:false,transferPending:false,canGoBack:false,closeCamera:()=>closed++,goBack:()=>back++};
 assert.equal(handleAndroidBack(input),false);
 assert.equal(handleAndroidBack({...input,canGoBack:true}),true);assert.equal(back,1);
 assert.equal(handleAndroidBack({...input,cameraOpen:true,canGoBack:true}),true);assert.equal(closed,1);assert.equal(back,1);
 assert.equal(handleAndroidBack({...input,cameraOpen:true,transferPending:true}),true);assert.equal(closed,1);
});

test('private TEST build requires an explicit Preview and preserves a separate application identity',()=>{
 const profile=process.env.MYEVENT_BUILD_PROFILE,target=process.env.EXPO_PUBLIC_MYEVENT_WEB_URL;
 try{
  process.env.MYEVENT_BUILD_PROFILE='test-private';delete process.env.EXPO_PUBLIC_MYEVENT_WEB_URL;
  assert.throws(()=>configure({config}),/Preview TEST/);
  for(const url of ['https://my-event-eosin.vercel.app/','https://foreign.test/','https://my-event-git-refactor-final-spegagnemarc-netizen.vercel.app/?token=secret']){
   process.env.EXPO_PUBLIC_MYEVENT_WEB_URL=url;assert.throws(()=>configure({config}),/non autorisée/);
  }
  process.env.EXPO_PUBLIC_MYEVENT_WEB_URL='https://my-event-git-refactor-final-spegagnemarc-netizen.vercel.app/';
  const result=configure({config});assert.equal(result.android.package,'app.myevent.mobile.dev');assert.equal(result.ios.bundleIdentifier,'app.myevent.mobile.dev');assert.equal(result.name,'MyEvent TEST');
 }finally{for(const [name,value] of [['MYEVENT_BUILD_PROFILE',profile],['EXPO_PUBLIC_MYEVENT_WEB_URL',target]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
