import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const session=readFileSync(new URL('../js/music-session.js',import.meta.url),'utf8');
const controller=readFileSync(new URL('../js/music-controller.js',import.meta.url),'utf8');
const tracks=['a','b','c'].map(id=>({provider:'youtube',provider_track_id:id,title:id}));
async function boot(){
 const dom=new JSDOM('<body></body>',{url:'https://orevami.test',runScripts:'outside-only'}),w=dom.window;let user='alice',player;
 w.myeventMusicContext=()=>({user:{id:user}});w.eval(session);
 w.YT={Player:class{constructor(id,options){player=this;this.options=options;this.position=0;this.video=options.videoId;queueMicrotask(()=>options.events.onReady({target:this}));}playVideo(){this.options.events.onStateChange({data:1});}pauseVideo(){this.options.events.onStateChange({data:2});}cueVideoById(x){this.video=x.videoId;this.position=x.startSeconds;}getCurrentTime(){return this.position;}getDuration(){return 180;}seekTo(x){this.position=x;}setVolume(x){this.volume=x;}destroy(){}end(){this.options.events.onStateChange({data:0});}}};
 w.eval(controller);const P=w.MyEventMusicPlayback;await P.play(tracks[0],tracks);await Promise.resolve();
 return {w,dom,P,player:()=>player,user:id=>{user=id;w.MyEventMusicSession.get();}};
}
test('DJ advances on end, supports pause, previous and repeat without another provider request',async()=>{
 const a=await boot();assert(a.P.playing);a.P.toggle();assert(!a.P.playing);a.P.toggle();assert(a.P.playing);
 a.player().end();assert.equal(a.P.current.provider_track_id,'b');a.P.previous();assert.equal(a.P.current.provider_track_id,'a');
 a.P.settings({repeat:'one'});a.player().position=180;a.player().end();assert.equal(a.P.current.provider_track_id,'a');assert.equal(a.player().position,0);
 a.P.settings({repeat:'all'});a.P.previous();assert.equal(a.P.current.provider_track_id,'c');a.player().end();assert.equal(a.P.current.provider_track_id,'a');a.dom.window.close();
});
test('DJ shuffle traverses the queue without repeats; settings and mood survive reload per account',async()=>{
 const a=await boot();a.P.settings({shuffle:true,volume:35});a.w.MyEventMusicSession.update({djMood:'Chill'});
 const heard=[a.P.current.provider_track_id];a.player().end();heard.push(a.P.current.provider_track_id);a.player().end();heard.push(a.P.current.provider_track_id);assert.equal(new Set(heard).size,3);
 const stored=JSON.parse(a.w.localStorage.getItem('myevent.music.v2.alice'));assert.equal(stored.playbackSettings.volume,35);assert.equal(stored.djMood,'Chill');assert.equal(stored.playbackQueue.length,3);
 a.user('bob');assert.equal(a.P.current,null);assert.equal(a.w.MyEventMusicSession.get().playbackSettings.volume,80);a.user('alice');assert.equal(a.w.MyEventMusicSession.get().djMood,'Chill');a.dom.window.close();
});
test('Disabling automatic advancement stops on the current title and queue updates retain valid tracks',async()=>{
 const a=await boot();a.P.settings({autoAdvance:false});a.player().end();assert.equal(a.P.current.provider_track_id,'a');assert(!a.P.playing);
 a.P.setQueue([tracks[0],tracks[0],tracks[2]]);assert.equal(a.P.queue.length,2);a.P.next();assert.equal(a.P.current.provider_track_id,'c');assert.match(a.w.document.querySelector('[data-mini-artist]').textContent,/^$/);a.dom.window.close();
});
test('Personal playlist create, rename, reorder and delete persist without Supabase writes',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const dom=new JSDOM(html,{url:'https://orevami.test',runScripts:'outside-only'}),w=dom.window;
 w.myeventMusicContext=()=>({user:{id:'alice'}});w.fetch=async()=>({ok:false,json:async()=>({error:'No external requests in focused test'})});w.eval(session);
 w.eval(readFileSync(new URL('../js/music-runtime.js',import.meta.url),'utf8'));w.eval(controller);w.eval(readFileSync(new URL('../js/music-workspace.js',import.meta.url),'utf8'));
 const go=()=>w.MyEventMusicWorkspace.go('playlists',false),click=text=>{const b=[...w.document.querySelectorAll('#musicScreen button')].find(x=>x.textContent===text);assert(b,text);b.click();};
 go();w.prompt=()=> 'Ma soirée';click('＋ Créer une playlist');const list=w.MyEventMusicSession.get().playlists[0];assert.equal(list.name,'Ma soirée');list.tracks.push(...tracks);go();
 w.prompt=()=> 'Anniversaire';click('Renommer');assert.equal(list.name,'Anniversaire');click('↓');assert.equal(list.tracks[0].provider_track_id,'b');click('Retirer');assert.equal(list.tracks.length,2);
 const saved=JSON.parse(w.localStorage.getItem('myevent.music.v2.alice'));assert.equal(saved.playlists[0].name,'Anniversaire');assert.equal(saved.playlists[0].tracks[0].provider_track_id,'a');click('Supprimer la playlist');assert.equal(w.MyEventMusicSession.get().playlists.length,0);dom.window.close();
});
