/* One Events workspace. Existing panels and handlers are moved, never duplicated. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),bridge=window.myeventEventsBridge;
 const home=$('socialHome'),legacy=$('eventsCard'),nav=$('socialBottomNav');
 if(!home||!legacy||!bridge||!nav)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons=Object.fromEntries(["weather","call","discussion","polls","media","tasks","aioutings","fund","music","games","hall","outings"].map(key=>[key,'<img src="assets/ui/me-card-'+key+'.svg" alt="" width="28" height="28">']));
 const tools=[['weather','Météo','Prévisions sur place'],['call','Appel de groupe','Retrouvez les participants'],['discussion','Discussion','Échangez avec votre groupe'],['polls','Sondages','Prenez des décisions'],['media','Photos','Partagez vos souvenirs'],['tasks','Tâches','Organisez et suivez les tâches'],['aioutings','Sortie IA','Préparez votre sortie'],['fund','Cagnotte','Gérez le budget'],['music','Musique','Playlist de l’événement'],['games','Jeux','Animations du groupe'],['hall','Salles','Trouvez une salle pour votre événement'],['outings','Restaurants','Restaurants et activités autour de vous']];
 const titles={weather:'Météo',call:'Appel de groupe',discussion:'Discussion',polls:'Sondages',media:'Photos et vidéos',tasks:'Tâches',members:'Participants',programme:'Programme',locations:'Lieux',supplies:'Matériel',transport:'Trajets',documents:'Documents',notifications:'Notifications de l’événement',createEventCard:'Créer un événement',joinCard:'Invitations',editEventBox:'Modifier l’événement',inviteCard:'Inviter des participants',fund:'Cagnotte',hall:'Salle',outings:'Sorties',accommodation:'Hébergement',localtravel:'Déplacements',aioutings:'Programme IA',music:'Musique',games:'Jeux'};
 const root=document.createElement('section');root.id='eventsWorkspace';root.hidden=true;
 root.setAttribute('aria-label','Événements');
 root.innerHTML=`<div class="ewLanding">
  <header class="ewHeader"><div><h1><span aria-hidden="true">📅</span> Événements</h1><p>Organise, partage et profite ensemble !</p></div><button class="ewCreate" data-form="createEventCard">＋ Créer un événement</button></header>
  <nav class="ewTabs" aria-label="Choisir les événements">${[['all','Mes événements'],['upcoming','À venir'],['past','Passés'],['invites','Invitations'],['discover','Découvrir']].map(([key,title])=>`<button data-filter="${key}" aria-pressed="${key==='all'}">${title}</button>`).join('')}</nav>
  <div id="ewEventPicker"></div><p id="ewStatus" role="status" aria-live="polite"></p>
  <div id="ewHero"></div>
  <div class="ewToolsCarousel" aria-label="Outils de l’événement, faire glisser pour voir la suite"><div class="ewTools">${[tools.slice(0,6),tools.slice(6)].map((page,index)=>`<div class="ewToolsPage" aria-label="Page ${index+1} des outils">${page.map(([key,label,description])=>`<button class="ewTool ew-${key}" data-tool="${key}"><span class="ewToolIcon" aria-hidden="true">${icons[key]}</span><span><strong>${label}</strong><small>${description}</small></span><span class="ewArrow" aria-hidden="true">›</span></button>`).join('')}</div>`).join('')}</div></div>
  <div class="ewCarouselControls" aria-label="Pages des outils"><button data-tools-page="0" aria-label="Afficher les six premiers outils" aria-current="true">1</button><button data-tools-page="1" aria-label="Afficher les six autres outils" aria-current="false">2</button><span>Faire glisser pour voir les autres outils</span></div>
  <nav class="ewSections" aria-label="Organisation de l’événement">${[['members','♟','Participants'],['programme','☷','Programme'],['locations','⌖','Lieux'],['supplies','▣','Matériel'],['transport','▰','Trajets'],['documents','▤','Documents']].map(([key,icon,label])=>`<button data-tool="${key}"><span aria-hidden="true">${icon}</span> ${label}</button>`).join('')}</nav>
  <section class="ewSection"><header><h2>📅 Programme</h2><button data-tool="programme">Voir tout ›</button></header><div id="ewProgramme"></div></section>
  <div class="ewExtras"><button data-tool="accommodation">⌂ Hébergement</button><button data-tool="outings">✦ Sorties</button><button data-tool="localtravel">⌖ Déplacements</button><button data-form="joinCard">Rejoindre avec un code</button></div>
 </div>
 <div class="ewToolPage" hidden><header class="ewToolHead"><button data-back aria-label="Retour aux événements">‹ Retour</button><h2 id="ewToolTitle"></h2></header><div id="ewToolBody"></div></div><div id="ewDepot" hidden></div>`;
 home.insertBefore(root,nav);
 const setNavActive=key=>nav.querySelectorAll('[data-bottom-tab],#socialBottomCreate').forEach(b=>{const active=(b.dataset.bottomTab||'camera')===key;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 let cameraPreviousTab='feed',cameraWasOpen=false;
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab]');if(b)queueMicrotask(()=>setNavActive(b.dataset.bottomTab));},true);
 document.addEventListener('click',e=>{const b=e.target.closest('#socialHeaderEventsBtn,#socialHeaderGamesBtn,#socialHeaderMusicBtn,#profileAvatar,#closeProfileBtn');if(b){const key={socialHeaderEventsBtn:'events',socialHeaderGamesBtn:'games',socialHeaderMusicBtn:'music',profileAvatar:'profile',closeProfileBtn:'feed'}[b.id];queueMicrotask(()=>setNavActive(key));}},true);
 new MutationObserver(()=>{if(!document?.body)return;const open=document.body.classList.contains('camera-is-open');if(open===cameraWasOpen)return;if(open){cameraPreviousTab=nav.querySelector('[data-bottom-tab].active')?.dataset.bottomTab||'feed';setNavActive('camera');}else setNavActive(cameraPreviousTab);cameraWasOpen=open;}).observe(document.body,{attributes:true,attributeFilter:['class']});
 const depot=$('ewDepot'),body=$('ewToolBody');
 const panels=new Map();
 const park=node=>{if(node){depot.appendChild(node);node.classList.add('ewPanel');}};
 // The original event list remains available to camera event selection and core renderers.
 for(const id of ['createEventCard','joinCard','editEventBox','inviteCard']){panels.set(id,$(id));park($(id));}
 park(legacy);
 for(const [key,id] of [['weather','weatherCard'],['call','groupCallCard'],['notifications','notificationCenter']]){panels.set(key,$(id));park($(id));}
 for(const node of document.querySelectorAll('.tabPanel[data-panel]')){panels.set(node.dataset.panel,node);park(node);}
 const oldTabs=document.querySelector('.eventTabs');park(oldTabs);
 let filter='all',screen='landing',busy=false,revision=0,pendingTool=null;
 const landing=root.querySelector('.ewLanding'),toolPage=root.querySelector('.ewToolPage');
 const context=()=>bridge.context();
 function status(text){$('ewStatus').textContent=text||'';}
 function isOpen(){return !root.hidden;}
 function closeTool(){
  bridge.closeDiscussion();
  for(const node of panels.values())if(node?.parentNode===body){park(node);node.open=false;node.classList.remove('active');}
  body.replaceChildren();toolPage.hidden=true;landing.hidden=false;screen='landing';
 }
 function close(){closeTool();root.hidden=true;document.body.classList.remove('eventsWorkspaceOpen');}
 function route(key){if(window.MyEventSectionNavigation){window.MyEventSectionNavigation.visit('events',key,context().event?.id);return;}if(!history.state?.eventsWorkspace&&key==='landing')history.pushState({eventsWorkspace:true,key},'',location.pathname+location.search+'#events');else if(key!==history.state?.key)history.pushState({eventsWorkspace:true,key},'',location.pathname+location.search+'#events/'+encodeURIComponent(key));}
 function showScreen(key){
  closeTool();screen=key;landing.hidden=true;toolPage.hidden=false;$('ewToolTitle').textContent=titles[key]||'Événement';
  root.scrollIntoView({block:'start'});
  route(key);
 }
 async function open(selectedId){
  root.hidden=false;legacy.hidden=true;document.body.classList.add('eventsWorkspaceOpen');
  nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='events'));
  closeTool();if(!selectedId)route('landing');status('Chargement de vos événements…');
  const ticket=++revision;
  try{
   if(!context().user){status('Connectez-vous pour retrouver vos événements.');render();return;}
   await bridge.load();if(ticket!==revision||!isOpen())return;
   const rows=context().events;
   if(selectedId&&!rows.some(e=>e.id===selectedId)){close();throw new Error('Cet événement n’est pas accessible.');}
   if(selectedId&&context().event?.id!==selectedId){busy=true;try{await bridge.select(selectedId);}finally{busy=false;}}
   if(rows.length&&!rows.some(e=>e.id===context().event?.id)){busy=true;try{await bridge.select(rows[0].id);}finally{busy=false;}}
   if(ticket!==revision||!isOpen())return;
   status('');render();if(selectedId)route('selected');root.scrollIntoView({block:'start'});
  }catch(error){status('Impossible de charger les événements : '+(error.message||String(error)));render();if(selectedId)throw error;}
 }
 async function select(id){
  if(busy)return;busy=true;status('Ouverture de l’événement…');
  try{await bridge.select(id);status('');render();if(pendingTool){const key=pendingTool;pendingTool=null;openTool(key);}}
  catch(error){status(error.message||String(error));}finally{busy=false;render();}
 }
 function visibleEvents(){return context().events.filter(e=>{
  if(filter==='all')return true;
  const date=Date.parse(e.event_date);if(!Number.isFinite(date))return false;
  return filter==='past'?date<Date.now():date>=Date.now();
 });}
 function members(){return [...($('members')?.querySelectorAll('.memberRow')||[])];}
 function renderProgramme(target=$('ewProgramme'),full=false){
  target.replaceChildren();
  const source=$('eventPlanningTimeline');
  const rows=[...(source?.querySelectorAll('.inlineEventTimelineItem')||[])];
  if(!rows.length){
   if(source){const clone=source.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));clone.querySelectorAll('button').forEach((button,i)=>button.onclick=()=>source.querySelectorAll('button')[i]?.click());target.appendChild(clone);}
   else target.innerHTML='<p class="ewEmpty">'+(context().event?'Aucune activité prévue pour cet événement.':'Choisissez un événement pour retrouver son programme.')+'</p>';
  }else{
   rows.slice(0,full?rows.length:3).forEach((row,index)=>{
    const title=row.querySelector('.inlineEventTimelineName')?.textContent?.trim()||'Activité';
    const time=row.querySelector('.inlineEventTimelineTime')?.textContent?.trim()||'Date à préciser';
    const meta=row.querySelector('.inlineEventTimelineMeta')?.textContent?.trim()||'';
    const icon=row.querySelector('.inlineEventTimelineDot');
    const card=document.createElement('button');
    card.type='button';card.className='ewProgrammeCompact';
    card.setAttribute('aria-label','Détails : '+title);
    const thumb=document.createElement('span');thumb.className='ewProgrammeThumb';
    const img=icon?.querySelector('img');
    if(img){const copy=img.cloneNode(true);copy.removeAttribute('id');copy.alt='';thumb.appendChild(copy);}
    else thumb.textContent=icon?.textContent?.trim()||'📅';
    const copy=document.createElement('span');copy.className='ewProgrammeCopy';
    const date=document.createElement('span');date.className='ewProgrammeDate';date.textContent=time;
    const name=document.createElement('strong');name.textContent=title;
    copy.append(date,name);
    if(meta){const location=document.createElement('span');location.className='ewProgrammeMeta';location.textContent=meta;copy.appendChild(location);}
    const arrow=document.createElement('span');arrow.className='ewProgrammeChevron';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
    card.append(thumb,copy,arrow);
    card.onclick=()=>{
     showScreen('programme');
     body.replaceChildren();
     const back=document.createElement('button');back.className='ewProgrammeBack';back.type='button';back.textContent='‹ Retour au programme';back.onclick=()=>{showScreen('programme');renderProgramme(body,true);};
     const heading=document.createElement('h3');heading.className='ewProgrammeDetailTitle';heading.textContent=title;
     const detail=row.cloneNode(true);detail.removeAttribute('id');detail.classList.add('ewProgrammeDetail');
     detail.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
     detail.querySelectorAll('button').forEach((button,i)=>button.onclick=()=>row.querySelectorAll('button')[i]?.click());
     body.append(back,heading,detail);
    };
    target.appendChild(card);
   });
  }
  if(full){const button=document.createElement('button');button.className='ewCreate';button.textContent='Organiser une activité';button.onclick=()=>openTool('outings');target.appendChild(button);}
 }
 async function renderHero(){
  const ticket=++heroRevision,target=$('ewHero'),e=context().event;
  if(!e||!visibleEvents().some(row=>row.id===e.id)){target.innerHTML='<div class="ewEmptyCard"><span>📅</span><h2>'+ (visibleEvents().length?'Choisissez votre événement':'Vos moments à partager commencent ici')+'</h2><p>'+ (visibleEvents().length?'Sélectionnez un événement pour retrouver ses outils.':'Créez un événement ou rejoignez votre groupe avec un code d’invitation.')+'</p><button class="ewCreate" data-form="createEventCard">＋ Créer un événement</button></div>';return;}
  const date=Date.parse(e.event_date),upcoming=!Number.isFinite(date)||date>=Date.now(),canManage=['owner','coorganizer'].includes(context().role);
  target.innerHTML=`<article class="ewHeroCard"><div class="ewHeroShade"></div><div class="ewHeroTop"><span class="ewState ${upcoming?'':'ewPast'}">${upcoming?'À venir':'Passé'}</span><div>${canManage?'<button data-form="editEventBox">✎ Modifier</button>':''}<button data-tool="notifications" class="ewHeroNotifications" aria-label="Notifications de cet événement" title="Notifications">🔔</button><button data-event-menu aria-label="Actions de l’événement">•••</button></div></div><div class="ewHeroCopy"><h2>${esc(e.name||'Événement')}</h2><p>▦ <span>${Number.isFinite(date)?esc(new Date(date).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})):'Date à définir'}</span></p><p>⌖ <span>${esc(e.location||'Lieu à définir')}</span></p><div class="ewHeroBottom"><button data-tool="members">♟ ${members().length} participants</button><div class="ewHeroAvatars"></div></div></div><div class="ewDots">${visibleEvents().map(row=>`<button data-select="${esc(row.id)}" aria-label="Ouvrir ${esc(row.name)}" aria-current="${row.id===e.id}"></button>`).join('')}</div></article>`;
  const actions=document.createElement('div');actions.className='ewHeroActions';actions.innerHTML='<button type="button" data-event-details>👁 Voir</button><button type="button" data-tool="locations">📍 Localiser</button>';target.appendChild(actions);
  const hall=document.createElement('section');hall.id='ewSelectedHall';hall.className='ewSelectedHall';target.appendChild(hall);window.myeventHallSelection?.ensure();
  members().slice(0,4).forEach(row=>{const avatar=row.querySelector('.avatar');if(avatar)target.querySelector('.ewHeroAvatars').appendChild(avatar.cloneNode(true));});
  try{
   const owner=context().user?.id,key=JSON.stringify([owner,e.id,e.cover_url]);
   for(const [k,v] of coverCache)if(v.owner!==owner||v.expires<Date.now())coverCache.delete(k);
   let entry=coverCache.get(key);
   if(!entry&&e.cover_url){entry={owner,expires:Date.now()+45*60*1000,promise:Promise.resolve().then(()=>bridge.cover(e.cover_url)).catch(error=>{coverCache.delete(key);throw error;})};coverCache.set(key,entry);}
   const url=entry?await entry.promise:'';
   if(!url)coverCache.delete(key);
   if(ticket!==heroRevision||context().event?.id!==e.id)return;
   const card=target.querySelector('.ewHeroCard');if(url&&card){const image=document.createElement('img');image.className='ewHeroPhoto';image.alt='Photo de '+(e.name||'l’événement');image.onerror=()=>{coverCache.delete(key);image.remove();};image.src=url;card.prepend(image);}
  }catch(_){/* The gradient remains when no real photo is accessible. */}
 }
 const coverCache=new Map();
 let heroRevision=0;
 function render(){
  if(!isOpen()||busy)return;
  const rows=visibleEvents();
  $('ewEventPicker').innerHTML=rows.length>1?`<label for="ewSelectedEvent">Votre événement</label><select id="ewSelectedEvent">${rows.map(e=>`<option value="${esc(e.id)}" ${e.id===context().event?.id?'selected':''}>${esc(e.name||'Événement')}</option>`).join('')}</select>`:'';
  $('ewSelectedEvent')?.addEventListener('change',e=>select(e.target.value));
  root.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  const selected=rows.some(e=>e.id===context().event?.id);
  root.querySelectorAll('.ewHallSearchAccess,.ewTools button,.ewSections button,.ewExtras [data-tool],.ewSection [data-form="inviteCard"],.ewSection [data-tool="programme"]').forEach(b=>{b.disabled=!selected;});
  renderHero();renderProgramme();
 }
 async function openTool(key){
  if(!context().event){pendingTool=key;await open();status('Sélectionnez un événement pour ouvrir '+(titles[key]||'cet outil')+'.');return;}
  if(key==='music'||key==='games'){
   const shortcut=nav.querySelector('[data-bottom-tab="'+key+'"]');
   if(shortcut){shortcut.click();return;}
   status('La rubrique '+(titles[key]||key)+' est momentanément indisponible.');return;
  }
  if(key==='discussion'){showScreen(key);bridge.tab('discussion',true);return;}
  showScreen(key);
  if(key==='details'){
   const e=context().event;body.innerHTML='<h3>'+esc(e.name||'Événement')+'</h3><p>'+esc(e.description||'Aucune description.')+'</p><p>📅 '+esc(e.event_date?new Date(e.event_date).toLocaleString('fr-FR'):'Date à définir')+'</p><p>📍 '+esc(e.location||'Lieu à définir')+'</p>';
   const participants=document.createElement('button');participants.type='button';participants.textContent='Voir les participants';participants.onclick=()=>openTool('members');body.appendChild(participants);return;
  }
  if(key==='programme'){renderProgramme(body,true);return;}
  if(key==='tasks'){
   const actions=document.createElement('div');actions.className='ewTaskActions';
   const material=document.createElement('button');material.type='button';material.textContent='🎒 Matériel · Qui apporte quoi ?';material.onclick=()=>openTool('supplies');
   actions.appendChild(material);body.appendChild(actions);
  }
  if(key==='documents'){
   const documents=$('messages')?.querySelectorAll('a.chatAttachmentFile')||[];
   body.innerHTML='<p class="ewEmpty">Les documents partagés dans la discussion de cet événement.</p>';
   documents.forEach(link=>body.appendChild(link.cloneNode(true)));
   if(!documents.length){const p=document.createElement('p');p.textContent='Aucun document partagé pour le moment.';body.appendChild(p);}
   const add=document.createElement('button');add.textContent='Ouvrir les pièces jointes de la discussion';add.onclick=()=>openTool('discussion');body.appendChild(add);return;
  }
  const panel=panels.get(key);if(!panel){body.textContent='Cette rubrique est indisponible.';return;}
  if(panel.dataset.panel)bridge.tab(key,true);
  body.appendChild(panel);panel.hidden=false;panel.classList.remove('hidden');panel.classList.add('active');panel.open=true;
  // bridge.tab(key,true) restores panel state and intentionally skips its loaders.
  if(key==='tasks'&&typeof loadEventTasks==='function')loadEventTasks();
  if(key==='locations')bridge.locations?.();
  if(key==='hall'&&typeof loadHall==='function')loadHall();
 }
 function showForm(id){
  if(!root.hidden){showScreen(id);const panel=panels.get(id);if(panel){body.appendChild(panel);panel.open=true;panel.hidden=false;panel.classList.remove('hidden');}}
 }
 function form(id){
  if(['editEventBox','inviteCard'].includes(id)&&!context().event){status('Choisissez d’abord un événement.');return;}
  root.hidden=false;document.body.classList.add('eventsWorkspaceOpen');bridge.form(id);
 }
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-tools-page')){const track=root.querySelector('.ewTools');track.scrollTo({left:Number(b.dataset.toolsPage)*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
  if(b.hasAttribute('data-back')){if(window.MyEventSectionNavigation)window.MyEventSectionNavigation.back();else history.back();return;}
  if(b.hasAttribute('data-event-details')){openTool('details');return;}
  if(b.dataset.form){form(b.dataset.form);return;}
  if(b.dataset.tool){openTool(b.dataset.tool);return;}
  if(b.dataset.select){select(b.dataset.select);return;}
  if(b.hasAttribute('data-event-menu')){
   const original=legacy.querySelector(`.eventCard[data-event-id="${CSS.escape(String(context().event?.id))}"] .eventCardMenu`);
   showScreen('actions');$('ewToolTitle').textContent='Actions de l’événement';
   const actions=document.createElement('div');actions.className='ewEventActions';actions.setAttribute('aria-label','Actions de l’événement');
   if(original)original.querySelectorAll('button').forEach(action=>{
    const b=action.cloneNode(true);
    b.classList.add('ewEventAction');
    b.dataset.eventAction=action.classList.contains('deleteEventBtn')?'delete':action.classList.contains('editEventListBtn')?'edit':action.classList.contains('inviteEventListBtn')?'invite':action.classList.contains('leaveEventBtn')?'leave':'other';
    b.onclick=()=>{if(!action.disabled)action.click();};actions.appendChild(b);
   });
   if(actions.children.length)body.appendChild(actions);else body.textContent='Aucune action disponible pour cet événement.';return;
  }
  if(b.dataset.filter){
   const next=b.dataset.filter;
   if(next==='discover'){close();$('socialExploreBtn')?.click();return;}
   if(next==='invites'){form('joinCard');return;}
   filter=next;const rows=visibleEvents();if(rows.length&&!rows.some(e=>e.id===context().event?.id))select(rows[0].id);else render();
  }
 });
 nav.addEventListener('click',event=>{
  const target=event.target.closest('[data-bottom-tab]');if(!target)return;
  if(target.dataset.bottomTab==='events'){event.preventDefault();event.stopImmediatePropagation();open();}
  else{revision++;close();if(history.state?.eventsWorkspace)history.replaceState({},'',location.pathname+location.search+'#home');}
 },true);
 window.myeventOpenEvents=open;
 const toolsTrack=root.querySelector('.ewTools');
 toolsTrack.addEventListener('scroll',()=>{const page=Math.round(toolsTrack.scrollLeft/Math.max(1,toolsTrack.clientWidth));root.querySelectorAll('[data-tools-page]').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.toolsPage)===page)));},{passive:true});
 window.myeventEventsWorkspace={open,openSelected:id=>open(id),close,showForm,openTool,render,restore:async state=>{await open(state.eventId);if(state.page&&!['landing','selected'].includes(state.page))await openTool(state.page);},syncTab:(key,state)=>{if(isOpen()&&state&&screen!==key)openTool(key);else if(isOpen()&&!state&&screen===key){closeTool();render();}}};
 // Old shortcuts may still be invoked by notifications, camera or planning actions.
 oldTabs?.addEventListener('click',event=>{const b=event.target.closest('[data-tab]');if(isOpen()&&b){event.stopImmediatePropagation();openTool(b.dataset.tab);}},true);
 document.addEventListener('click',event=>{
  if(event.target.closest('#socialHeaderEventsBtn')){event.preventDefault();event.stopImmediatePropagation();open();return;}
  if(event.target.closest('#socialHeaderSearchBtn,#socialFriendsShortcut,#socialHeaderMessagesBtnTop,#socialHeaderNotificationsBtnTop,#socialHeaderMusicBtn,#socialHeaderGamesBtn'))close();
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen()&&screen!=='landing'){closeTool();render();}});
 let scheduled=false;
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(isOpen()){if(!context().user){close();return;}render();}});});
 for(const id of ['eventList','members','mediaGrid'])if($(id))observer.observe($(id),{subtree:true,childList:true,characterData:true});
 // Core may close Discussion through its own arrow: return to the landing screen.
 const discussion=$('discussionPanel');discussion?.addEventListener('toggle',()=>{if(screen==='discussion'&&!discussion.open){closeTool();render();}});
 window.addEventListener('popstate',()=>{if(window.MyEventSectionNavigation)return;if(history.state?.eventsWorkspace){if(root.hidden){root.hidden=false;document.body.classList.add('eventsWorkspaceOpen');}if(history.state.key==='landing'){closeTool();render();}else openTool(history.state.key);}else{close();nav.querySelector('[data-bottom-tab="feed"]')?.click();}});
})();
