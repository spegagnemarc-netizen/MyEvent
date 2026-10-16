import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('js/home-social-runtime.js');
const handlers=source.slice(source.indexOf("  $s('socialOpenComposer')?."),source.indexOf("  document.addEventListener('click',e=>{"));
const css=read('css/inline-extracted.css');
const rules=css.slice(css.indexOf('/* Publication compacte :'),css.indexOf('#socialHome .socialSectionHead{',css.indexOf('/* Publication compacte :')));
function fixture({user={id:'fictional-test'},error=null}={}){
 const dom=new JSDOM('<style>'+rules+'</style><section id="socialHome"><div class="socialComposer"><button id="socialOpenComposer">Partager</button></div><div class="socialComposerPanel" id="socialComposerPanel"><textarea id="socialPostText"></textarea><button id="socialPublishBtn">Publier</button><button id="socialCancelPostBtn">Annuler</button><p id="socialPostMsg"></p></div></section>',{runScripts:'outside-only'}),w=dom.window,calls=[];
 w.myeventCameraContext=()=>({user,sb:{from(table){return{insert:async row=>{calls.push({table,row});return{error};}};}}});
 w.myeventRefreshSocialFeed=async()=>calls.push('refresh');
 w.eval("function $s(id){return document.getElementById(id)}\n"+handlers);
 return{w,calls,dom};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('composer is visible; actual open/cancel handlers reveal and hide the form',()=>{
 const {w}=fixture();try{const panel=w.document.getElementById('socialComposerPanel');assert.equal(w.getComputedStyle(w.document.querySelector('.socialComposer')).display,'flex');assert.equal(w.getComputedStyle(panel).display,'none');w.document.getElementById('socialOpenComposer').click();assert.equal(w.getComputedStyle(panel).display,'block');assert.equal(w.document.activeElement.id,'socialPostText');w.document.getElementById('socialCancelPostBtn').click();assert.equal(w.getComputedStyle(panel).display,'none');}finally{w.close();}
});
test('existing publisher inserts the session author and refreshes the feed on success',async()=>{const {w,calls}=fixture();try{w.document.getElementById('socialOpenComposer').click();w.document.getElementById('socialPostText').value='Publication fictive';w.document.getElementById('socialPublishBtn').click();await settle();assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{table:'event_feed_posts',row:{author_id:'fictional-test',body:'Publication fictive'}},'refresh']);assert.equal(w.document.getElementById('socialPostText').value,'');assert.equal(w.document.getElementById('socialPublishBtn').disabled,false);}finally{w.close();}});
test('permission error preserves the draft, displays the error and releases the button',async()=>{const {w}=fixture({error:{message:'RLS refused (simulation)'}});try{w.document.getElementById('socialOpenComposer').click();w.document.getElementById('socialPostText').value='Brouillon TEST';w.document.getElementById('socialPublishBtn').click();await settle();assert.equal(w.document.getElementById('socialPostText').value,'Brouillon TEST');assert.match(w.document.getElementById('socialPostMsg').textContent,/RLS refused/);assert.equal(w.document.getElementById('socialPublishBtn').disabled,false);assert.equal(w.getComputedStyle(w.document.getElementById('socialComposerPanel')).display,'block');}finally{w.close();}});
test('missing session never inserts a post',async()=>{const {w,calls}=fixture({user:null});try{w.document.getElementById('socialPostText').value='Brouillon TEST';w.document.getElementById('socialPublishBtn').click();await settle();assert.equal(calls.length,0);assert.match(w.document.getElementById('socialPostMsg').textContent,/Connecte-toi/);}finally{w.close();}});
