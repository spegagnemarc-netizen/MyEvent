import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../js/feed-media-viewer.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/event-social-feed.css',import.meta.url),'utf8');
const flush=()=>new Promise(r=>setTimeout(r,5));
function fixture(){
 const dom=new JSDOM('<body style="color:red"><section id="socialHome"><div id="socialFeed"><article class="socialPost"><div class="socialPostHead"><div class="socialPostAvatar"><img src="https://example.test/avatar"></div><b>Auteur</b></div><p class="socialPostText">Texte conservé</p><img id="photo" src="https://example.test/original" alt="Photo ORÉVAMI"><img id="second" src="https://example.test/second"><video controls playsinline></video><div class="socialActions"><button id="like">J’aime</button><button id="comment">Commenter</button></div></article></div></section></body>',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
 let left=0,top=512;Object.defineProperties(w,{scrollX:{get:()=>left},scrollY:{get:()=>top}});
 w.scrollTo=arg=>{left=arg.left;top=arg.top;};w.requestAnimationFrame=fn=>{fn();};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 const like=w.document.getElementById('like'),video=w.document.querySelector('video');let likes=0;like.onclick=()=>likes++;
 w.eval(source);return {w,dom,like,video,likes:()=>likes};
}
test('prepares photos and adjacent galleries without replacing authors, video or interaction nodes',async()=>{
 const f=fixture(),{w}=f;await flush();
 assert.equal(w.document.querySelectorAll('.socialPostPhotoButton').length,2);assert.equal(w.document.querySelectorAll('.socialFeedMediaGallery').length,1);
 assert.equal(w.document.querySelector('.socialPostAvatar img').parentElement.className,'socialPostAvatar');assert.equal(w.document.querySelector('video'),f.video);assert(f.video.controls);assert(f.video.hasAttribute('playsinline'));
 assert.equal(w.document.getElementById('like'),f.like);f.like.click();assert.equal(f.likes(),1);assert.equal(w.document.querySelector('.socialPostText').textContent,'Texte conservé');assert.equal(w.document.getElementById('photo').src,'https://example.test/original');f.dom.window.close();
});
test('opens the original source and restores window and gallery scroll, body style and focus',()=>{
 const {w,dom}=fixture(),gallery=w.document.querySelector('.socialFeedMediaGallery');gallery.scrollLeft=147;
 const photo=w.document.getElementById('photo'),button=photo.parentElement;button.click();const dialog=w.document.querySelector('dialog');
 assert(dialog.open);assert.equal(dialog.querySelector('img').src,photo.src);assert.equal(w.document.body.style.position,'fixed');
 gallery.scrollLeft=0;w.scrollTo({left:5,top:0});dialog.querySelector('.socialFeedPhotoClose').click();
 assert(!dialog.open);assert.equal(w.scrollY,512);assert.equal(w.scrollX,0);assert.equal(gallery.scrollLeft,147);assert.equal(w.document.body.style.position,'');assert.equal(w.document.body.style.color,'red');assert.equal(w.document.activeElement,button);assert.equal(dialog.querySelector('img').hasAttribute('src'),false);dom.window.close();
});
test('zoom controls and two-pointer pinch update only the viewer image',()=>{
 const {w,dom}=fixture();w.document.getElementById('photo').parentElement.click();const d=w.document.querySelector('dialog'),stage=d.querySelector('.socialFeedPhotoStage');
 d.querySelector('[data-feed-zoom="in"]').click();assert.equal(d.querySelector('output').textContent,'150 %');
 d.querySelector('[data-feed-zoom="reset"]').click();assert.equal(d.querySelector('output').textContent,'100 %');
 const pointer=(name,id,x)=>{const e=new w.Event(name,{bubbles:true});Object.assign(e,{pointerId:id,pointerType:'touch',clientX:x,clientY:100});stage.dispatchEvent(e);};
 pointer('pointerdown',1,50);pointer('pointerdown',2,100);pointer('pointermove',2,150);assert.equal(d.querySelector('output').textContent,'200 %');
 for(let i=0;i<10;i++)d.querySelector('[data-feed-zoom="in"]').click();assert.equal(d.querySelector('output').textContent,'400 %');assert(d.querySelector('[data-feed-zoom="in"]').disabled);
 assert.equal(w.document.getElementById('photo').style.transform,'');d.close();dom.window.close();
});
test('native dialog close (including Escape) restores state, and repeated opens reuse one viewer',()=>{
 const {w,dom}=fixture(),button=w.document.getElementById('photo').parentElement;button.click();const d=w.document.querySelector('dialog');d.close();button.click();assert.equal(w.document.querySelectorAll('dialog').length,1);assert(d.open);d.close();assert.equal(w.document.body.style.position,'');dom.window.close();
});
test('newly rendered posts are enhanced once and videos never become photo buttons',async()=>{
 const {w,dom}=fixture();const article=w.document.createElement('article');article.className='socialPost';article.innerHTML='<img src="https://example.test/later"><video controls></video>';w.document.getElementById('socialFeed').append(article);await flush();
 assert.equal(article.querySelectorAll('.socialPostPhotoButton').length,1);assert.equal(article.querySelector('video').parentElement.className,'socialFeedMediaGallery');assert.equal(article.querySelectorAll('.socialFeedMediaGallery').length,1);await flush();assert.equal(article.querySelectorAll('.socialFeedMediaGallery').length,1);dom.window.close();
});
test('closing via backdrop keeps existing post nodes and translated image labels do not control sizing',()=>{
 const {w,dom,like}=fixture();w.document.getElementById('second').parentElement.click();const d=w.document.querySelector('dialog');d.dispatchEvent(new w.Event('click',{bubbles:true}));assert(!d.open);assert.equal(w.document.getElementById('like'),like);
 assert(css.includes('height:250px!important'));assert(css.includes('object-fit:contain!important'));assert(css.includes('padding-bottom:calc(120px + env(safe-area-inset-bottom'));
 const old=readFileSync(new URL('../css/inline-extracted.css',import.meta.url),'utf8');assert(!old.includes('img[alt="Photo MyEvent"]'));dom.window.close();
});
