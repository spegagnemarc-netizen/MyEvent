import test from 'node:test';
import assert from 'node:assert/strict';
import {createTcfConsentBridge,hasAdvertisingConsent} from '../js/ads-consent.mjs';
const data={cmpId:300,listenerId:12,cmpStatus:'loaded',eventStatus:'useractioncomplete',gdprApplies:true,tcString:'simulated-TCF-data-not-a-real-record',vendor:{consents:{755:true}},purpose:{consents:{1:true,3:true,4:true}}};
test('CMP acceptance requires complete expected signal; missing, refusal, error and restrictions block',()=>{
 assert(hasAdvertisingConsent(data,true));
 for(const value of [{...data,cmpId:42},{...data,tcString:''},{...data,gdprApplies:false},{...data,eventStatus:'cmpuishown'},{...data,cmpStatus:'error'},{...data,purpose:{consents:{1:true,3:false,4:true}}},{...data,vendor:{consents:{755:false}}},{...data,publisher:{restrictions:{3:{755:0}}}},{...data,publisher:{restrictions:{3:{755:2}}}}])assert.equal(hasAdvertisingConsent(value,true),false);
 assert.equal(hasAdvertisingConsent(data,false),false);
});
test('acceptance, refusal, withdrawal and listener teardown remain offline',()=>{
 let cb;const changes=[],commands=[];const scope={__tcfapi:(cmd,_version,callback,id)=>{commands.push([cmd,id]);if(cmd==='addEventListener')cb=callback;}};
 const bridge=createTcfConsentBridge({onChange:c=>changes.push(c.accepted)},scope);assert(bridge.initialize());assert(!bridge.initialize());
 cb(data,true);assert(bridge.accepted());cb({...data,vendor:{consents:{755:false}}},true);assert(!bridge.accepted());cb(data,true);assert(bridge.accepted());
 bridge.destroy();cb(data,true);assert(!bridge.accepted());assert.deepEqual(changes,[true,false,true]);assert(commands.some(c=>c[0]==='removeEventListener'&&c[1]===12));
});
test('official Google preference UI is queued only when installed; no fake CMP loaded',()=>{
 assert.equal(createTcfConsentBridge({},{}).initialize(),false);assert.equal(createTcfConsentBridge({},{}).openPreferences(),false);
 let calls=0;const queue=[],changes=[];const b=createTcfConsentBridge({onChange:c=>changes.push(c.accepted)},{googlefc:{callbackQueue:queue,showRevocationMessage(){calls++;}}});
 assert(b.openPreferences());assert.equal(calls,0);assert.deepEqual(changes,[false]);queue[0].CONSENT_API_READY();assert.equal(calls,1);
});
