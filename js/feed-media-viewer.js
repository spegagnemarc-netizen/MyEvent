/* Feed presentation only: original media and post interaction nodes are retained. */
(()=>{
 'use strict';
 const feed=document.getElementById('socialFeed');if(!feed)return;
 let viewer,stage,image,zoomLabel,session=null,scale=1,x=0,y=0,gesture=null,moved=false;
 const points=new Map(),limit=(v,min,max)=>Math.max(min,Math.min(max,v));
 function draw(){
  if(!image||!stage)return;
  const maxX=Math.max(0,(image.clientWidth*scale-stage.clientWidth)/2),maxY=Math.max(0,(image.clientHeight*scale-stage.clientHeight)/2);
  x=limit(x,-maxX,maxX);y=limit(y,-maxY,maxY);
  image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
  zoomLabel.textContent=Math.round(scale*100)+' %';
  viewer.querySelector('[data-feed-zoom="out"]').disabled=scale<=1;
  viewer.querySelector('[data-feed-zoom="in"]').disabled=scale>=4;
 }
 function zoom(next,px=0,py=0){const old=scale;scale=limit(next,1,4);x=px-(px-x)*scale/old;y=py-(py-y)*scale/old;if(scale===1)x=y=0;draw();}
 function rebase(){
  const p=[...points.values()];
  gesture=p.length>=2?{scale,x,y,distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),mid:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}}:p.length?{x,y,point:p[0]}:null;
 }
 function position(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};}
 function close(){if(viewer?.open)viewer.close();}
 function restore(){
  const saved=session;if(!saved)return;session=null;
  points.clear();gesture=null;image.removeAttribute('src');image.removeAttribute('style');
  for(const [key,value,priority]of saved.styles){if(value)document.body.style.setProperty(key,value,priority);else document.body.style.removeProperty(key);}
  const root=document.documentElement,value=root.style.getPropertyValue('scroll-behavior'),priority=root.style.getPropertyPriority('scroll-behavior');
  root.style.setProperty('scroll-behavior','auto','important');
  const putBack=()=>{for(const [el,left,top]of saved.scroll){if(el.isConnected)el.scrollTo?el.scrollTo({left,top,behavior:'instant'}):(el.scrollLeft=left,el.scrollTop=top);}window.scrollTo({left:saved.x,top:saved.y,behavior:'instant'});};
  if(saved.opener?.isConnected)saved.opener.focus({preventScroll:true});putBack();
  requestAnimationFrame(()=>{if(!session)putBack();if(value)root.style.setProperty('scroll-behavior',value,priority);else root.style.removeProperty('scroll-behavior');});
 }
 function createViewer(){
  viewer=document.createElement('dialog');viewer.className='socialFeedPhotoViewer';viewer.setAttribute('aria-label','Photo entière');
  viewer.innerHTML='<button type="button" class="socialFeedPhotoClose" aria-label="Fermer la photo">×</button><div class="socialFeedPhotoStage"><img alt="Photo entière" draggable="false"></div><div class="socialFeedPhotoZoom" aria-label="Zoom de la photo"><button type="button" data-feed-zoom="out" aria-label="Réduire la photo">−</button><output aria-live="polite">100 %</output><button type="button" data-feed-zoom="in" aria-label="Agrandir la photo">+</button><button type="button" data-feed-zoom="reset">Réinitialiser</button></div>';
  document.body.append(viewer);stage=viewer.querySelector('.socialFeedPhotoStage');image=stage.querySelector('img');zoomLabel=viewer.querySelector('output');
  viewer.querySelector('.socialFeedPhotoClose').onclick=close;
  viewer.addEventListener('close',restore);
  viewer.addEventListener('click',e=>{if(e.target===viewer)close();});
  viewer.querySelectorAll('[data-feed-zoom]').forEach(b=>b.onclick=()=>zoom(b.dataset.feedZoom==='reset'?1:scale*(b.dataset.feedZoom==='in'?1.5:1/1.5)));
  image.onload=draw;
  image.onerror=()=>{zoomLabel.textContent='Photo indisponible';};
  stage.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;points.set(e.pointerId,position(e));stage.setPointerCapture?.(e.pointerId);moved=false;rebase();});
  stage.addEventListener('pointermove',e=>{
   if(!points.has(e.pointerId)||!gesture)return;
   points.set(e.pointerId,position(e));const p=[...points.values()];
   if(p.length>=2&&gesture.distance>0){
    const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
    scale=limit(gesture.scale*Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/gesture.distance,1,4);
    x=mid.x-(gesture.mid.x-gesture.x)*scale/gesture.scale;y=mid.y-(gesture.mid.y-gesture.y)*scale/gesture.scale;moved=true;
   }else if(gesture.point){x=gesture.x+p[0].x-gesture.point.x;y=gesture.y+p[0].y-gesture.point.y;if(Math.hypot(p[0].x-gesture.point.x,p[0].y-gesture.point.y)>4)moved=true;}
   draw();
  });
  const end=e=>{points.delete(e.pointerId);rebase();};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,end);
  stage.addEventListener('click',e=>{if(e.target===stage&&!moved)close();});
  stage.addEventListener('dblclick',e=>{e.preventDefault();const p=position(e);zoom(scale>1?1:2,p.x,p.y);});
  stage.addEventListener('wheel',e=>{e.preventDefault();const p=position(e);zoom(scale*Math.exp(-e.deltaY*.002),p.x,p.y);},{passive:false});
  viewer.addEventListener('keydown',e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();zoom(e.key==='0'?1:scale*(e.key==='-'?1/1.5:1.5));}});
  window.addEventListener('resize',()=>{if(viewer.open)draw();});
 }
 function open(photo,opener){
  if(!photo?.src||session)return;
  if(!viewer)createViewer();
  const body=document.body,keys=['position','top','left','right','width','overflow'];
  session={opener,x:window.scrollX,y:window.scrollY,styles:keys.map(k=>[k,body.style.getPropertyValue(k),body.style.getPropertyPriority(k)]),scroll:[]};
  for(let el=opener?.parentElement;el;el=el.parentElement)session.scroll.push([el,el.scrollLeft,el.scrollTop]);
  const width=body.getBoundingClientRect().width;
  scale=1;x=y=0;moved=false;image.alt=photo.alt||'Photo entière';image.src=photo.currentSrc||photo.src;
  Object.assign(body.style,{position:'fixed',top:-session.y+'px',left:-session.x+'px',right:'0',width:width+'px',overflow:'hidden'});
  try{viewer.showModal();draw();viewer.querySelector('.socialFeedPhotoClose').focus({preventScroll:true});}catch(error){restore();throw error;}
 }
 function eligible(media){return media.closest('.socialPost')&&!media.closest('.socialPostAvatar,.socialCommentAvatar,.socialCommentBox,.socialAvatars,.socialEventCard,.socialPostHead');}
 function prepare(post){
  const nodes=[];
  for(const media of post.querySelectorAll('img,video')){
   if(!eligible(media))continue;
   if(media.tagName==='VIDEO'){
    media.classList.add('socialFeedMediaVideo');nodes.push(media);continue; // Keep native playback, controls and listeners intact.
   }
   media.classList.add('socialFeedMediaImage');
   let button=media.closest('button,a');
   if(!button){button=document.createElement('button');button.type='button';media.before(button);button.append(media);}
   button.classList.add('socialPostPhotoButton');button.setAttribute('aria-label','Afficher la photo entière');nodes.push(button);
  }
  if(nodes.length<2)return;
  const parent=nodes[0].parentElement;
  if(!parent||!nodes.every(n=>n.parentElement===parent)||parent.classList.contains('socialFeedMediaGallery'))return;
  const children=[...parent.children],positions=nodes.map(n=>children.indexOf(n));
  if(!positions.every((n,i)=>i===0||n===positions[i-1]+1))return;
  // Group only adjacent media. Never move text, author details or interaction controls.
  const gallery=document.createElement('div');gallery.className='socialFeedMediaGallery';gallery.setAttribute('aria-label','Médias de la publication, faire défiler horizontalement');gallery.tabIndex=0;
  nodes[0].before(gallery);for(const node of nodes)gallery.append(node);
 }
 function attach(root){
  if(root.nodeType!==1)return;
  const post=root.closest('.socialPost');if(post&&feed.contains(post))prepare(post);
  root.querySelectorAll?.('.socialPost').forEach(prepare);
 }
 feed.addEventListener('click',e=>{
  const photo=e.target.closest('.socialPostPhotoButton')?.querySelector('img')||e.target.closest('img.socialFeedMediaImage');
  if(!photo||!eligible(photo))return;e.preventDefault();open(photo,photo.closest('button,a')||photo);
 });
 new MutationObserver(records=>{const posts=new Set();for(const record of records){const p=record.target.closest?.('.socialPost');if(p)posts.add(p);for(const n of record.addedNodes)if(n.nodeType===1){const p=n.closest('.socialPost');if(p)posts.add(p);n.querySelectorAll?.('.socialPost').forEach(p=>posts.add(p));}}for(const p of posts)if(feed.contains(p))prepare(p);}).observe(feed,{childList:true,subtree:true});
 attach(feed);
 window.myeventFeedMedia={open,close};
})();
