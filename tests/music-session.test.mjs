import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/music-session.js',import.meta.url),'utf8');
function boot(storage=new Map()){
  let user='alice';const events=[];const window={myeventMusicContext:()=>({user:user?{id:user}:null}),dispatchEvent:e=>events.push(e.type)};
  const context=vm.createContext({window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type){this.type=type;}}});vm.runInContext(source,context);
  return {session:window.MyEventMusicSession,events,user:id=>user=id,storage};
}
test('music sessions restore query, prompt and position without playing and isolate accounts',()=>{
  const app=boot();app.session.update({query:'Jazz',prompt:'Route',screen:'ai',position:42,current:{provider:'youtube',provider_track_id:'abc'},draft:[{title:'A'}]});
  app.user('bob');assert.equal(app.session.get().draft.length,0);assert.equal(app.session.get().current,null);
  app.user('alice');assert.equal(app.session.get().position,42);assert.equal(app.session.get().prompt,'Route');assert.equal(app.events.filter(e=>e==='music-user-change').length,2);
  const reload=boot(app.storage);assert.equal(reload.session.get().query,'Jazz');assert.equal(reload.session.get().screen,'ai');assert.equal(reload.session.get().position,42);
});
test('corrupt or unavailable local storage does not block music',()=>{
  const storage=new Map([['myevent.music.v2.alice','broken json']]);const app=boot(storage);assert.equal(app.session.get().recent.length,0);
  storage.set=()=>{throw Error('quota');};app.session.update({query:'Pop'});assert.equal(app.session.get().query,'Pop');assert.ok(app.events.includes('music-storage-error'));
});
