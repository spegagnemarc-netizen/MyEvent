/* Shared section headers and same-origin navigation. No database operations. */
(()=>{
 'use strict';
 const names={events:'Événements',marketplace:'Marketplace',music:'Musique',games:'Jeux',profile:'Profil'};
 const storeKey='myevent-navigation-v1';
 let epoch=Date.now(),stack=[{section:'home'}],restoring=false,ready=false;
 try{const saved=JSON.parse(sessionStorage.getItem(storeKey)||'null');if(saved?.stack?.length){epoch=saved.epoch;stack=saved.stack;}}catch(_){}
 const save=()=>{try{sessionStorage.setItem(storeKey,JSON.stringify({epoch,stack}));}catch(_){}};
 const current=()=>stack[stack.length-1];
 const url=s=>location.pathname+location.search+'#'+(s.section==='home'?'home':s.section+(s.page&& !['landing','home','hub'].includes(s.page)?'/'+encodeURIComponent(s.page):''));
 function state(){return {myeventNavigation:true,epoch,stack:stack.map(s=>({...s}))};}
 function active(section){document.querySelectorAll('#socialBottomNav [data-bottom-tab],#socialBottomCreate').forEach(b=>{const yes=b.dataset.bottomTab===(section==='home'?'feed':section);b.classList.toggle('active',yes);if(yes)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
 function header(section){
  const h=document.createElement('header');h.className='meSectionHeader';h.dataset.sectionHeader=section;
  const brand=document.createElement('div');brand.className='meSectionBrand';brand.append('My');const accent=document.createElement('span');accent.textContent='Event';brand.append(accent);
  const row=document.createElement('div');row.className='meSectionTitleRow';
  const title=document.createElement('h1');title.textContent=names[section];
  const close=document.createElement('button');close.type='button';close.className='meSectionClose';close.textContent='×';close.setAttribute('aria-label','Fermer et revenir à l’accueil');close.title='Fermer';close.onclick=()=>api.close();
  row.append(title,close);h.append(brand,row);return h;
 }
 function hideOther(section){
  if(section!=='events')window.myeventEventsWorkspace?.close();
  if(section!=='music'&&document.getElementById('musicHome')?.classList.contains('open'))window.MyEventMusic?.closeMusic();
  if(section!=='games'&&document.getElementById('entertainmentLounge')?.classList.contains('open'))window.myeventEntertainment?.close();
  document.body.classList.toggle('profileSectionOpen',section==='profile');
  if(section!=='profile')window.myeventProfileNavigation?.close();
 }
 async function render(s){
  restoring=true;
  try{
   hideOther(s.section);
   if(s.section==='events')await window.myeventEventsWorkspace?.restore(s);
   else if(s.section==='music')window.MyEventMusicWorkspace?.go(s.page||'home',false);
   else if(s.section==='games')window.myeventEntertainment?.restore(s);
   else if(s.section==='profile'){window.myeventProfileNavigation?.open();document.getElementById(s.page==='settings'?'myeventAppearanceCard':'profileSettingsCard')?.scrollIntoView({block:'start'});}
   else if(s.section==='marketplace'){
    document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!==s.page)d.close();});
    const dialog=document.getElementById(s.page);if(dialog&&!dialog.open)dialog.showModal();
   }
   if(s.section==='home'){document.getElementById('socialBottomNav')?.querySelector('[data-bottom-tab="feed"]')?.click();window.scrollTo({top:0});}
   active(s.section);
  }finally{restoring=false;}
 }
 function visit(section,page,eventId){
  if(!names[section]||restoring)return;
  hideOther(section);active(section);
  const next={section,page:page||({events:'landing',music:'home',games:'hub',marketplace:'home',profile:'home'}[section]),...(eventId?{eventId}:{})};
  if(JSON.stringify(current())===JSON.stringify(next))return;
  stack.push(next);save();history.pushState(state(),'',url(next));
 }
 function back(){
  if(stack.length>1){stack.pop();save();history.replaceState(state(),'',url(current()));void render(current());}
  else if(location.pathname.endsWith('marketplace.html')){
   let target='index.html#home';try{const previous=sessionStorage.getItem('myevent-market-return');if(previous&&/^index\.html#(home|events|music|games|profile)(\/[^\s]*)?$/.test(previous))target=previous;}catch(_){}
   location.replace(target);
  }else api.close();
 }
 function close(){
  epoch=Date.now()+1;stack=[{section:'home'}];save();
  if(location.pathname.endsWith('marketplace.html')){location.replace('index.html#home');return;}
  window.MyEventMusicWorkspace?.resetNavigation();history.replaceState(state(),'',url(current()));void render(current());
 }
 const api=window.MyEventSectionNavigation={header,visit,back,close,current};
 window.addEventListener('popstate',e=>{
  if(!ready)return;
  if(e.state?.myeventNavigation&&e.state.epoch===epoch){stack=e.state.stack;save();void render(current());}
  else {stack=[{section:'home'}];save();history.replaceState(state(),'',url(current()));void render(current());}
 });
 function mount(){
  ready=true;
  for(const [section,id] of [['events','eventsWorkspace'],['music','musicHome'],['profile','profileSettingsCard']]){
   const root=document.getElementById(id);if(root){root.prepend(header(section));if(section==='profile'){const settings=document.createElement('button');settings.type='button';settings.className='secondary';settings.textContent='Paramètres et apparence';settings.onclick=()=>{visit('profile','settings');document.getElementById('myeventAppearanceCard')?.scrollIntoView({block:'start'});};root.querySelector('.meSectionHeader').after(settings);const appearance=document.getElementById('myeventAppearanceCard');if(appearance){const internalBack=document.createElement('button');internalBack.type='button';internalBack.textContent='‹ Retour au profil';internalBack.onclick=()=>api.back();appearance.prepend(internalBack);}}}
  }
  const market=document.getElementById('myeventMarketplace');
  if(market){
   const marketHead=market.querySelector('.marketHeader'),identity=document.createElement('div');identity.className='meMarketplaceIdentity';const brand=marketHead.querySelector('.brand');identity.append(brand);identity.append(header('marketplace').querySelector('.meSectionClose'));marketHead.prepend(identity);stack=[{section:'marketplace',page:'home'}];save();history.replaceState(state(),'',url(current()));
   market.querySelectorAll('dialog').forEach(d=>{const close=d.querySelector('.dialogClose');if(close){close.addEventListener('click',e=>{e.stopImmediatePropagation();api.close();},true);}d.addEventListener('close',()=>{if(!restoring&&current().section==='marketplace'&&current().page===d.id)back();});});
  }else{
   const hash=location.hash.slice(1).split('/'),section=hash[0];
   if(names[section]){const saved=current();stack= saved.section===section?stack:[{section:'home'},{section,page:hash[1]||undefined}];history.replaceState(state(),'',url(current()));void render(current());}
   else {stack=[{section:'home'}];save();history.replaceState(state(),'',url(current()));}
  }
  document.addEventListener('click',e=>{
   const link=e.target.closest('a[href*="marketplace.html"]');if(link){try{sessionStorage.setItem('myevent-market-return','index.html'+location.hash);}catch(_){}}
   const item=e.target.closest('#socialBottomNav [data-bottom-tab]');if(item?.dataset.bottomTab==='feed'&&!restoring){stack=[{section:'home'}];save();history.replaceState(state(),'',url(current()));hideOther('home');active('home');}
  },true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
