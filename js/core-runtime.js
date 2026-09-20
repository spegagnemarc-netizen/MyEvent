/* ===== original inline script 4 ===== */
let sb=null,user=null,event=null;
let realtimeChannel=null;
let notificationPollTimer=null;


// V54.36 — Discussion en vrai plein écran : le panneau est temporairement
// déplacé directement sous <body>. Cela évite les contraintes de mise en page
// du conteneur principal sur iPhone et garantit 100% de la hauteur/largeur.
let discussionPortalPlaceholder=null;
let discussionPortalHome=null;
let discussionPortalShell=null;

function ensureDiscussionPortalShell(){
  if(discussionPortalShell) return discussionPortalShell;
  const panel=document.getElementById('discussionPanel');
  if(!panel) return null;
  discussionPortalPlaceholder=document.createComment('MyEvent discussion portal');
  discussionPortalHome=panel.parentNode;
  if(discussionPortalHome) discussionPortalHome.insertBefore(discussionPortalPlaceholder,panel);

  const shell=document.createElement('div');
  shell.id='discussionPortalShell';
  shell.setAttribute('role','dialog');
  shell.setAttribute('aria-label','Discussion');
  shell.className='discussionPortalShell';
  document.body.appendChild(shell);
  discussionPortalShell=shell;
  return shell;
}

// V54.39 — la flèche de réduction doit rester visible dans le vrai plein écran.
// Le <summary> n'est plus enfant du <details> quand Discussion est portée par le portal,
// donc son chevron CSS natif n'est plus fiable. On ajoute un bouton explicite.
function ensureDiscussionCollapseButton(summary){
  if(!summary) return null;
  let btn=summary.querySelector('#discussionPortalCollapseBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.type='button';
    btn.id='discussionPortalCollapseBtn';
    btn.className='discussionPortalCollapseBtn secondary';
    btn.setAttribute('aria-label','Réduire la Discussion');
    btn.setAttribute('title','Réduire la Discussion');
    btn.textContent='⌄';
    summary.appendChild(btn);
  }
  return btn;
}

function stopActiveVoiceBeforeDiscussionClose(){
  if(mediaRecorder && mediaRecorder.state==='recording'){
    try{mediaRecorder.stop()}catch{}
  }
}

function syncDiscussionFullscreenPortal(shouldOpen){
  const panel=document.getElementById('discussionPanel');
  const shell=ensureDiscussionPortalShell();
  if(!panel||!shell)return;

  if(shouldOpen){
    // Ne pas utiliser <details> comme conteneur plein écran : ses règles de
    // mise en page peuvent rester contraintes par le layout iOS. On porte
    // uniquement son contenu dans un vrai overlay fixed au niveau du body.
    if(panel.parentNode!==shell){
      const summary=panel.querySelector(':scope > summary');
      shell.appendChild(summary);
      shell.appendChild(panel.querySelector(':scope > .collapsibleBody'));
      ensureDiscussionCollapseButton(summary);
    }else{
      ensureDiscussionCollapseButton(shell.querySelector(':scope > summary'));
    }
    panel.classList.add('active');
    panel.open=true;
    shell.classList.add('open');
  }else{
    // V54.39 — fermeture idempotente : remettre les deux enfants exactement
    // dans leur <details> d'origine avant de quitter Discussion.
    stopActiveVoiceBeforeDiscussionClose();
    shell.classList.remove('open');
    const summary=shell.querySelector(':scope > summary');
    const content=shell.querySelector(':scope > .collapsibleBody');
    if(summary && summary.parentNode===shell) panel.appendChild(summary);
    if(content && content.parentNode===shell) panel.appendChild(content);
    panel.classList.remove('active');
    panel.open=false;
  }
}

function showEventTab(name, forceState=null){
  const target=document.querySelector('.tabPanel[data-panel="'+name+'"]');
  if(!target)return;
  const alreadyActive=target.classList.contains('active');
  const shouldOpen=forceState===null ? !alreadyActive : forceState;
  const initialRestore = forceState===true;

  // Ne mémorise une vue que lorsqu'elle est réellement ouverte.
  // Si l'utilisateur referme l'onglet actif, on supprime son ancienne
  // préférence afin qu'il ne se rouvre pas automatiquement au prochain
  // affichage/rechargement de l'événement.
  if(user&&event){
    const key='myevent_active_tab_'+user.id+'_'+event.id;
    const persistable=!['outings','supplies'].includes(name);
    if(shouldOpen && persistable) localStorage.setItem(key,name);
    else if(!shouldOpen || !persistable) localStorage.removeItem(key);
  }

  document.querySelectorAll('.eventTab').forEach(btn=>{
    const active=btn.dataset.tab===name && shouldOpen;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
  });
  document.querySelectorAll('.tabPanel').forEach(panel=>{
    const active=panel===target && shouldOpen;
    panel.classList.toggle('active',active);
    panel.open=active;
  });

  const discussionOpen=name==='discussion' && shouldOpen;
  document.body.classList.toggle('discussionFullScreen', discussionOpen);
  syncDiscussionFullscreenPortal(discussionOpen);
  if(shouldOpen){
    // Une vue ouverte volontairement doit pouvoir être restaurée si l'utilisateur
    // quitte puis revient sur la page sans se déconnecter.
    if(!initialRestore && user&&event && !['outings','supplies'].includes(name)){
      sessionStorage.setItem('myevent_restore_view','1');
    }
    // During the automatic restore at login/reload, do not mark the discussion as read
    // before loadMessages() has located the unread/last message.
    if(!initialRestore){
      if(name==='discussion') markDiscussionRead();
      if(name==='polls') markPollsRead();
      if(name==='media') markMediaRead();
      if(name==='members') markMembersRead();
      if(name==='locations') loadEventLocations();
      if(name==='fund') loadFund();
      if(name==='hall'){ loadHall(); }
      if(name==='supplies'){ loadSupplies(); }
      if(name==='outings'){ searchOutings(); }
      if(name==='aioutings'){ if(typeof loadAiOutingPlan==='function') loadAiOutingPlan(); }
      setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),40);
    }
  }
}


// V54.39 — fermeture explicite par la flèche du portal.
document.addEventListener('click',e=>{
  const btn=e.target.closest('#discussionPortalCollapseBtn');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  showEventTab('discussion',false);
});

document.addEventListener('click',e=>{
  const btn=e.target.closest('.eventTab');
  if(btn){
    showEventTab(btn.dataset.tab);
    return;
  }
  const summary=e.target.closest('.tabPanel > summary, #discussionPortalShell > summary');
  if(summary){
    const panel=summary.closest('.tabPanel') || document.getElementById('discussionPanel');
    const tab=panel?.dataset.panel || 'discussion';
    if(tab){
      e.preventDefault();
      e.stopPropagation();
      showEventTab(tab, false);
    }
  }
});

const $=id=>document.getElementById(id);
function syncEventHeroSummary(){ const n=$('eventHeroName'), s=$('eventHeroSummaryText'); if(n&&s) s.textContent=n.textContent||'Mon événement'; }
if($('eventHeroName')) new MutationObserver(syncEventHeroSummary).observe($('eventHeroName'),{childList:true,characterData:true,subtree:true});

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function avatarHtml(value,cls='avatar'){ const v=String(value||''); if(/^https?:\/\//i.test(v)||/^data:image\//i.test(v)) return '<div class="'+cls+'"><img src="'+esc(v)+'" alt="Avatar"></div>'; return '<div class="'+cls+' avatarEmoji">'+esc(v||'👤')+'</div>'; }
let avatarDesign={skin:'#f6d2b3',hair:'#3b2418',eyes:'brown',style:'none',shirt:'#278cff'};
function buildAvatarSvg(d=avatarDesign){ const eye=d.eyes==='blue'?'#4da3ff':d.eyes==='green'?'#3f9b5f':'#5a3826'; const hairTop=d.style==='cap'?'':`<path d="M25 43 Q25 15 50 15 Q75 15 75 43 L69 36 Q64 27 50 27 Q36 27 31 36Z" fill="${d.hair}"/>`; const glasses=d.style==='glasses'?'<rect x=29 y=42 width=17 height=10 rx=5 fill="none" stroke="#20252b" stroke-width=3/><rect x=54 y=42 width=17 height=10 rx=5 fill="none" stroke="#20252b" stroke-width=3/><path d="M46 46h8" stroke="#20252b" stroke-width=3/>':''; const beard=d.style==='beard'?'<path d="M35 57 Q50 72 65 57 L62 69 Q50 79 38 69Z" fill="#3a2a23"/>':''; const cap=d.style==='cap'?'<path d="M24 38 Q50 11 76 38 L71 42 Q50 28 29 42Z" fill="#278cff"/><rect x=46 y=26 width=30 height=7 rx=3 fill="#278cff"/>':''; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#102131"/><path d="M22 100 Q25 72 50 72 Q75 72 78 100Z" fill="${d.shirt}"/><circle cx="50" cy="49" r="27" fill="${d.skin}"/>${hairTop}${cap}<circle cx="40" cy="47" r="4" fill="${eye}"/><circle cx="60" cy="47" r="4" fill="${eye}"/><path d="M43 61 Q50 66 57 61" fill="none" stroke="#7d3f3f" stroke-width="3" stroke-linecap="round"/>${glasses}${beard}</svg>`; }
function customAvatarData(d=avatarDesign){ return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(buildAvatarSvg(d)); }
function renderCustomAvatar(){ const url=customAvatarData(); $('customAvatarPreview').innerHTML='<img src="'+url+'" alt="Avatar personnalisé">'; document.querySelectorAll('.builderChoice').forEach(b=>b.classList.toggle('selected',b.dataset.value===avatarDesign[b.dataset.group])); }
function setAvatarChoice(v){ document.querySelectorAll('.avatarChoice').forEach(b=>b.classList.toggle('selected',b.dataset.avatar===v)); }

function msg(id,text,type='muted'){ $(id).textContent=text; $(id).className=type; }
function global(text,type='muted'){ msg('globalmsg',text,type); }

function setBusy(id,busy,label){
  const b=$(id);
  b.disabled=busy;
  if(label) b.textContent=label;
}


/* V48.6 — Localisation : activités renforcées + avatars sur la carte */
let locationMap=null, locationEventMarker=null, locationUserMarker=null, locationMemberMarkers=[], locationPlaceMarkers=[], locationEventCoords=null, locationSearchCenterMarker=null, locationSearchCircle=null, locationSearchCenter=null, locationHallMarker=null, locationOutingMarker=null;
let locationPlacesData=[], locationPlaceFilter='all', locationPlaceSearch='';
// V54.34 — centre de recherche utilisé comme source de vérité pour les recherches d'activités.
// Le point rouge reste fixe ; le point 🎯 peut être déplacé pour concentrer les résultats.
const locationSearchCentersByEvent=new Map();
function getStoredActivitySearchCenter(eventId){
  if(!eventId)return null;
  const key='myevent_activity_search_center_'+String(eventId);
  try{
    const v=JSON.parse(localStorage.getItem(key)||'null');
    if(v&&Number.isFinite(+v.lat)&&Number.isFinite(+v.lon))return {lat:+v.lat,lon:+v.lon};
  }catch(_){}
  const mem=locationSearchCentersByEvent.get(String(eventId));
  return mem&&Number.isFinite(+mem.lat)&&Number.isFinite(+mem.lon)?{lat:+mem.lat,lon:+mem.lon}:null;
}
function saveActivitySearchCenter(eventId,lat,lon){
  if(!eventId||!Number.isFinite(+lat)||!Number.isFinite(+lon))return;
  const v={lat:+lat,lon:+lon};
  locationSearchCentersByEvent.set(String(eventId),v);
  try{localStorage.setItem('myevent_activity_search_center_'+String(eventId),JSON.stringify(v));}catch(_){}
}
async function getActivitySearchCenter(){
  if(!event)return null;
  const saved=getStoredActivitySearchCenter(event.id);
  if(saved)return saved;
  if(locationSearchCenter&&Number.isFinite(+locationSearchCenter.lat)&&Number.isFinite(+locationSearchCenter.lon)){
    saveActivitySearchCenter(event.id,locationSearchCenter.lat,locationSearchCenter.lon);
    return {lat:+locationSearchCenter.lat,lon:+locationSearchCenter.lon};
  }
  const geo=await geocodeEventLocation();
  if(geo){
    saveActivitySearchCenter(event.id,geo.lat,geo.lon);
    return {lat:+geo.lat,lon:+geo.lon};
  }
  return null;
}
const locationIcons={restaurant:'🍽️',cafe:'☕',bar:'🍹',fast_food:'🍔',pub:'🍺',cinema:'🎬',theatre:'🎭',museum:'🏛️',attraction:'🎯',park:'🌳',playground:'🛝',sports_centre:'🏟️',bowling_alley:'🎳',fitness_centre:'🏋️',beach:'🏖️',gallery:'🖼️',viewpoint:'👀',arts_centre:'🎨',water_park:'💦'};
function clearLocationMarkers(){
  if(locationMap){ if(locationEventMarker)locationMap.removeLayer(locationEventMarker); if(locationSearchCenterMarker)locationMap.removeLayer(locationSearchCenterMarker); if(locationSearchCircle)locationMap.removeLayer(locationSearchCircle); if(locationUserMarker)locationMap.removeLayer(locationUserMarker); if(locationHallMarker)locationMap.removeLayer(locationHallMarker); if(locationOutingMarker)locationMap.removeLayer(locationOutingMarker); locationMemberMarkers.forEach(m=>locationMap.removeLayer(m)); locationPlaceMarkers.forEach(m=>locationMap.removeLayer(m)); }
  locationEventMarker=null; locationSearchCenterMarker=null; locationSearchCircle=null; locationSearchCenter=null; locationUserMarker=null; locationHallMarker=null; locationOutingMarker=null; locationMemberMarkers=[]; locationPlaceMarkers=[];
}
function makeLocationIcon(emoji,bg='#278cff'){
  return L.divIcon({className:'',html:'<div style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:'+bg+';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:19px">'+emoji+'</div>',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-18]});
}
function makeAvatarLocationIcon(avatar,bg='#6f5cff'){
  const v=String(avatar||'');
  const inner=(/^https?:\/\//i.test(v)||/^data:image\//i.test(v))
    ? '<img src="'+esc(v)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">'
    : '<span style="font-size:18px">'+esc(v||'👤')+'</span>';
  return L.divIcon({className:'',html:'<div style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:'+bg+';border:3px solid #fff;box-shadow:0 2px 9px rgba(0,0,0,.4);overflow:hidden">'+inner+'</div>',iconSize:[40,40],iconAnchor:[20,20],popupAnchor:[0,-20]});
}
function initLocationMap(lat=43.1242,lon=5.928,zoom=14){
  const el=$('locationMap'); if(!el||!window.L)return;
  if(!locationMap){
    locationMap=L.map(el,{zoomControl:true,attributionControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(locationMap);
  }
  locationMap.setView([lat,lon],zoom); setTimeout(()=>locationMap.invalidateSize(),80);
}
function setLocationMapView(lat,lon,zoom=15){ initLocationMap(lat,lon,zoom); if(locationMap)locationMap.setView([lat,lon],zoom,{animate:true}); }
function renderLocationSearchCenter(lat,lon,{fit=false,load=true}={}){
  if(!locationMap||!Number.isFinite(+lat)||!Number.isFinite(+lon))return;
  lat=+lat;lon=+lon;
  locationSearchCenter={lat,lon};
  if(event?.id)saveActivitySearchCenter(event.id,lat,lon);
  if(locationSearchCenterMarker)locationMap.removeLayer(locationSearchCenterMarker);
  if(locationSearchCircle)locationMap.removeLayer(locationSearchCircle);
  locationSearchCenterMarker=L.marker([lat,lon],{draggable:true,icon:makeLocationIcon('🎯','#278cff')}).addTo(locationMap);
  locationSearchCenterMarker.bindPopup('<b>🎯 Centre de recherche</b><br>Déplace ce point pour concentrer les activités dans un secteur.');
  locationSearchCenterMarker.on('dragend',async()=>{
    const ll=locationSearchCenterMarker.getLatLng();
    locationSearchCenter={lat:ll.lat,lon:ll.lng};
    if(event?.id)saveActivitySearchCenter(event.id,ll.lat,ll.lng);
    const hint=$('locationSearchCenterHint');
    if(hint)hint.textContent='🎯 Secteur déplacé · actualisation des activités…';
    await loadNearbyPlaces(ll.lat,ll.lng);
    updateLocationSearchCircle();
    if(hint)hint.textContent='🎯 Centre de recherche · déplace le point pour changer de secteur';
  });
  updateLocationSearchCircle();
  if(fit)locationMap.setView([lat,lon],15,{animate:true});
  if(load)loadNearbyPlaces(lat,lon);
}
function updateLocationSearchCircle(){
  if(!locationMap||!locationSearchCenter)return;
  if(locationSearchCircle)locationMap.removeLayer(locationSearchCircle);
  locationSearchCircle=L.circle([locationSearchCenter.lat,locationSearchCenter.lon],{radius:locationSearchRadiusKm*1000,fillOpacity:.06,weight:1.5,color:'#278cff'}).addTo(locationMap);
}
async function geocodeEventLocation(){
  if(!event)return null; const text=String(event.location||'').trim(); if(!text)return null;
  try{ const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q='+encodeURIComponent(text),{headers:{'Accept':'application/json'}}); if(!r.ok)return null; const d=await r.json(); if(d?.[0])return {lat:+d[0].lat,lon:+d[0].lon,address:d[0].display_name}; }catch(e){} return null;
}
let locationSearchRadiusKm=3;
function distanceKm(a,b,c,d){ const R=6371,rad=Math.PI/180, x=(c-a)*rad, y=(d-b)*rad; const q=Math.sin(x/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(y/2)**2; return 2*R*Math.asin(Math.sqrt(q)); }
async function fetchJsonWithTimeout(url,opts={},ms=12000){ const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),ms); try{ const r=await fetch(url,{...opts,signal:ctl.signal,headers:{Accept:'application/json',...(opts.headers||{})}}); if(!r.ok)throw new Error('HTTP '+r.status); return await r.json(); } finally{clearTimeout(t);} }
// V51.3 — Les recherches OSM passent désormais par l'API serveur MyEvent / Photon.
function locationPlaceCategory(type){
  type=String(type||'').toLowerCase();
  if(['restaurant','fast_food','bar','pub'].includes(type)) return type==='restaurant'||type==='fast_food'?'restaurant':'activity';
  if(type==='cafe') return 'cafe';
  if(['park','playground','beach','viewpoint'].includes(type)) return 'nature';
  if(['museum','gallery','theatre','cinema','arts_centre','attraction'].includes(type)) return 'culture';
  return 'activity';
}
function renderNearbyPlaces(){
  const el=$('locationPlaces'); if(!el)return;
  const q=locationPlaceSearch.trim().toLowerCase();
  const filtered=locationPlacesData.filter(p=>{
    const cat=locationPlaceCategory(p.type);
    const matchCat=locationPlaceFilter==='all'||cat===locationPlaceFilter;
    const matchSearch=!q||String(p.name||'').toLowerCase().includes(q)||String(p.type||'').toLowerCase().includes(q);
    return matchCat&&matchSearch;
  });
  const countEl=$('locationResultCount'); if(countEl)countEl.textContent=filtered.length+' résultat'+(filtered.length>1?'s':'');
  if(locationMap){locationPlaceMarkers.forEach(m=>locationMap.removeLayer(m));locationPlaceMarkers=[];}
  filtered.slice(0,40).forEach(p=>{
    if(locationMap){
      const m=L.marker([+p.lat,+p.lon],{icon:makeLocationIcon(locationIcons[p.type]||'📍','#16a085')}).addTo(locationMap);
      m.bindPopup('<b>'+esc(p.name)+'</b><br>'+esc(String(p.type).replaceAll('_',' '))+' · '+p.distance.toFixed(1)+' km');
      locationPlaceMarkers.push(m);
    }
  });
  el.innerHTML=filtered.slice(0,20).map(p=>'<div class="locationPlace"><div class="placeIcon">'+(locationIcons[p.type]||'📍')+'</div><div class="placeBody"><b>'+esc(p.name)+'</b><span>'+esc(String(p.type).replaceAll('_',' '))+' · '+p.distance.toFixed(1)+' km</span></div><button type="button" class="secondary locationGoBtn" data-lat="'+p.lat+'" data-lon="'+p.lon+'">Voir</button></div>').join('')||'<p class="muted">Aucun lieu ne correspond à ta recherche.</p>';
  el.querySelectorAll('.locationGoBtn').forEach(b=>b.onclick=(ev)=>{
    ev.preventDefault();ev.stopPropagation();
    const lat=+b.dataset.lat,lon=+b.dataset.lon;setLocationMapView(lat,lon,17);
    const marker=locationPlaceMarkers.find(m=>{const ll=m.getLatLng();return Math.abs(ll.lat-lat)<0.00001&&Math.abs(ll.lng-lon)<0.00001;});
    if(marker)marker.openPopup();
    const mapEl=$('locationMap');if(mapEl)mapEl.scrollIntoView({behavior:'smooth',block:'center'});
  });
}
async function loadNearbyPlaces(lat,lon){
  const el=$('locationPlaces'); if(!el)return;
  el.innerHTML='<p class="muted">🔎 Recherche des activités autour de l’événement…</p>';
  const api='/api/search-places?mode=nearby&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&radius='+encodeURIComponent(locationSearchRadiusKm);
  try{
    const r=await fetch(api,{headers:{Accept:'application/json'}});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d)throw new Error(d?.error||'Recherche indisponible');
    const arr=(d.results||[]).map(x=>({...x,lat:+x.lat,lon:+x.lon,distance:Number(x.distance)})).filter(x=>x.name&&Number.isFinite(x.lat)&&Number.isFinite(x.lon));
    locationPlacesData=arr;renderNearbyPlaces();
  }catch(e){locationPlacesData=[];el.innerHTML='<p class="muted">Les activités sont momentanément indisponibles. Appuie sur ↻ Actualiser pour réessayer.</p>';const countEl=$('locationResultCount');if(countEl)countEl.textContent='';}
}
async function loadSharedMemberLocations(){
  const wrap=$('locationMembers'); if(!wrap||!event||!user)return;
  try{
    const r=await sb.from('event_locations').select('user_id,lat,lon,accuracy,share_mode,updated_at').eq('event_id',event.id).neq('share_mode','off');
    if(r.error){wrap.innerHTML='<p class="muted">Les positions des membres seront disponibles après activation du partage.</p>'; $('locationMemberCount').textContent='0 membre'; return;}
    const allRows=r.data||[], mineRow=allRows.find(x=>x.user_id===user.id), shareSel=$('locationShareMode'); if(shareSel)shareSel.value=mineRow?.share_mode||'off';
    const rows=allRows.filter(x=>Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)); const ids=rows.map(x=>x.user_id).filter(Boolean); let profs=[];
    if(ids.length){const pr=await sb.from('profiles').select('id,display_name,avatar').in('id',ids);if(!pr.error)profs=pr.data||[];}
    const pm=new Map(profs.map(x=>[x.id,x]));
    if(locationMap){locationMemberMarkers.forEach(m=>locationMap.removeLayer(m));locationMemberMarkers=[];}
    rows.forEach(x=>{
      let lat=+x.lat,lon=+x.lon; if(x.share_mode==='approx'){lat=Math.round(lat*100)/100;lon=Math.round(lon*100)/100;}
      const p=pm.get(x.user_id)||{}, mine=x.user_id===user.id;
      if(locationMap){const m=L.marker([lat,lon],{icon:makeAvatarLocationIcon(p.avatar,mine?'#278cff':'#6f5cff')}).addTo(locationMap);m.bindPopup('<b>'+esc(p.display_name||'Membre')+'</b><br>'+(!mine&&x.share_mode==='approx'?'Position approximative':mine?'Ma position · '+(x.share_mode==='approx'?'approximative':'exacte'):'Position exacte'));locationMemberMarkers.push(m);}
    });
    $('locationMemberCount').textContent=rows.length+' membre'+(rows.length>1?'s':'');
    wrap.innerHTML=rows.map(x=>{const p=pm.get(x.user_id)||{};return '<div class="memberRow locationMember">'+avatarHtml(p.avatar,'miniAvatar')+'<div class="memberInfo"><b>'+esc(p.display_name||'Membre')+'</b><span>'+(x.share_mode==='approx'?'Position approximative':'Position exacte')+'</span></div></div>';}).join('')||'<p class="muted">Aucune position partagée.</p>';
  }catch(e){wrap.innerHTML='<p class="muted">Les positions des membres ne sont pas encore configurées.</p>';}
}
async function updateMyLocation(mode){
  if(!event||!user)return;
  if(mode==='off'){const r=await sb.from('event_locations').upsert({event_id:event.id,user_id:user.id,lat:null,lon:null,accuracy:null,share_mode:'off',updated_at:new Date().toISOString()},{onConflict:'event_id,user_id'});$('locationMsg').textContent=r.error?'Impossible d’arrêter le partage.':'Partage de position désactivé.';await loadSharedMemberLocations();return;}
  if(!navigator.geolocation){$('locationMsg').textContent='La géolocalisation n’est pas disponible sur cet appareil.';return;}
  $('locationMsg').textContent='📍 Recherche de ta position…';
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat=pos.coords.latitude,lon=pos.coords.longitude; setLocationMapView(lat,lon,16);
    if(locationUserMarker&&locationMap)locationMap.removeLayer(locationUserMarker);
    const pr=await sb.from('profiles').select('avatar').eq('id',user.id).maybeSingle(); const avatar=pr?.data?.avatar||'';
    if(locationMap)locationUserMarker=L.marker([lat,lon],{icon:makeAvatarLocationIcon(avatar,'#278cff')}).addTo(locationMap).bindPopup('📍 Ma position').openPopup();
    const payload={event_id:event.id,user_id:user.id,lat,lon,accuracy:pos.coords.accuracy||null,share_mode:mode,updated_at:new Date().toISOString()}; const r=await sb.from('event_locations').upsert(payload,{onConflict:'event_id,user_id'});
    $('locationMsg').textContent=r.error?'Impossible de partager la position : '+r.error.message:'Position partagée avec les membres de cet événement.'; await loadSharedMemberLocations();
  },err=>{$('locationMsg').textContent=err?.code===1?'⚠️ Autorisation refusée. Vérifie Réglages → Confidentialité et sécurité → Service de localisation → Safari.':'⚠️ Impossible d’obtenir ta position. Vérifie que la localisation est activée.';},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
async function loadEventLocations(){
  if(!event||!$('locationMap'))return; const loader=$('locationMapLoading'); if(loader)loader.style.display='grid'; initLocationMap(); const geo=await geocodeEventLocation();
  if(geo){
    locationEventCoords=geo;
    initLocationMap(geo.lat,geo.lon,14);
    if(locationEventMarker&&locationMap)locationMap.removeLayer(locationEventMarker);
    locationEventMarker=L.marker([geo.lat,geo.lon],{icon:makeLocationIcon('📍','#ff5b67')}).addTo(locationMap).bindPopup('<b>📍 Lieu de l’événement</b><br>'+esc(event.location||geo.address||'Lieu'));
    $('locationEventAddress').textContent=geo.address||event.location||'Lieu';
    const saved=getStoredActivitySearchCenter(event.id);
    const center=saved&&Number.isFinite(+saved.lat)&&Number.isFinite(+saved.lon)?saved:geo;
    renderLocationSearchCenter(center.lat,center.lon,{fit:false,load:true});
  }
  else{
    $('locationEventAddress').textContent=event.location||'Lieu non renseigné';
    locationPlacesData=[];
    $('locationPlaces').innerHTML='<p class="muted">Ajoute une adresse ou un lieu à l’événement pour afficher les activités autour.</p>';
  }
  await loadSharedMemberLocations();if(loader)loader.style.display='none';setTimeout(()=>locationMap?.invalidateSize(),100);
}
document.addEventListener('change',e=>{if(e.target?.id==='locationShareMode')updateMyLocation(e.target.value);});
document.addEventListener('input',e=>{if(e.target?.id==='locationPlaceSearch'){locationPlaceSearch=e.target.value||'';renderNearbyPlaces();}});
document.addEventListener('click',e=>{
  const f=e.target.closest('.placeFilter');
  if(f){locationPlaceFilter=f.dataset.filter||'all';document.querySelectorAll('.placeFilter').forEach(b=>b.classList.toggle('active',b===f));renderNearbyPlaces();}
});
document.addEventListener('click',e=>{
  if(e.target.closest('#locRadiusBtn')){
    const steps=[3,5,10,20];
    const i=steps.indexOf(locationSearchRadiusKm);
    locationSearchRadiusKm=steps[(i+1)%steps.length];
    const btn=e.target.closest('#locRadiusBtn');
    if(btn)btn.textContent='🔎 '+locationSearchRadiusKm+' km';
    updateLocationSearchCircle();
    if(locationSearchCenter)loadNearbyPlaces(locationSearchCenter.lat,locationSearchCenter.lon);
  }
  if(e.target.closest('#locCenterBtn')){
    if(locationEventCoords){
      setLocationMapView(locationEventCoords.lat,locationEventCoords.lon,15);
      renderLocationSearchCenter(locationEventCoords.lat,locationEventCoords.lon,{fit:false,load:true});
      if(event?.id)saveActivitySearchCenter(event.id,locationEventCoords.lat,locationEventCoords.lon);
    }else $('locationMsg').textContent='Le lieu de l’événement n’a pas encore pu être localisé.';
  }
  if(e.target.closest('#locMeBtn')){const msgEl=$('locationMsg');if(!navigator.geolocation){if(msgEl)msgEl.textContent='La géolocalisation n’est pas disponible dans ce navigateur.';return;}if(msgEl)msgEl.textContent='📍 Demande d’autorisation de localisation…';navigator.geolocation.getCurrentPosition(async pos=>{const {latitude,longitude}=pos.coords;setLocationMapView(latitude,longitude,16);if(locationUserMarker&&locationMap)locationMap.removeLayer(locationUserMarker);const pr=await sb.from('profiles').select('avatar').eq('id',user.id).maybeSingle();const avatar=pr?.data?.avatar||'';if(locationMap)locationUserMarker=L.marker([latitude,longitude],{icon:makeAvatarLocationIcon(avatar,'#278cff')}).addTo(locationMap).bindPopup('📍 Ma position').openPopup();if(msgEl)msgEl.textContent='📍 Ta position est affichée sur la carte. Pour la partager, choisis ensuite une option ci-dessous.';},err=>{if(msgEl)msgEl.textContent=err&&err.code===1?'⚠️ Autorisation refusée. Sur iPhone : Réglages → Confidentialité et sécurité → Service de localisation → Safari → Lorsque l’app est active.':'⚠️ Impossible d’obtenir ta position. Vérifie que la localisation est activée.';},{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
  if(e.target.closest('#locRefreshBtn'))loadEventLocations();
});

const SUPABASE_URL='https://nxxvadbliinhvkirqkkl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_jBqcZF0k-mNBp5HJGxniTQ_gcjkPgMn';

async function connect(){
  msg('status','Connexion à Supabase…');
  try{
    if(!window.supabase) throw new Error('La bibliothèque Supabase ne s’est pas chargée. Recharge la page.');
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
    const r=await sb.auth.getSession();
    if(r.error) throw r.error;
    $('setup').classList.add('hidden');
    if(r.data.session) await show(r.data.session.user);
    else { $('main').classList.add('hidden'); $('auth').classList.remove('hidden'); }
  }catch(e){
    msg('status',e.message||String(e),'err');
  }
}

async function signup(){
  msg('authmsg','Création du compte…');
  try{
    const r=await sb.auth.signUp({email:$('email').value.trim(),password:$('password').value});
    if(r.error) throw r.error;
    msg('authmsg','Compte créé. Vérifie ton email puis connecte-toi.','ok');
  }catch(e){msg('authmsg',e.message||String(e),'err')}
}

async function login(){
  msg('authmsg','Connexion…');
  try{
    const r=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    if(r.error) throw r.error;
    await show(r.data.user);
  }catch(e){msg('authmsg',e.message||String(e),'err')}
}

function renderProfile(p){
const name=p?.display_name||p?.username||user?.email?.split('@')[0]||'Membre';
$('profileName').value=p?.display_name||name;
$('profileUsername').value=p?.username||'';
const av=p?.avatar||'';
$('profileAvatar').innerHTML=/^(https?:\/\/|data:image\/)/i.test(av)?'<img src="'+esc(av)+'" alt="Avatar">':esc(av||name.charAt(0).toUpperCase()); setAvatarChoice(av); renderCustomAvatar();
}

let aiAvatarDataUrl='';
function setAiMsg(text,type='muted'){ const el=$('aiAvatarMsg'); if(el){el.textContent=text;el.className=type;} }
function fileToDataUrl(file,maxSide=1280,quality=.82){
  return new Promise((resolve,reject)=>{
    if(!file||!file.type.startsWith('image/')) return reject(new Error('Choisis une image valide.'));
    const img=new Image(); const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Impossible de lire la photo.'));
    reader.onload=()=>{ img.onload=()=>{
      const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.naturalWidth*scale)); c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',quality));
    }; img.onerror=()=>reject(new Error('Photo illisible.')); img.src=reader.result; };
    reader.readAsDataURL(file);
  });
}
function setAiPhotoPreview(dataUrl){
  $('aiPhotoPreview').src=dataUrl; $('aiPhotoPreview').classList.remove('hidden'); $('aiPhotoPlaceholder').classList.add('hidden');
}
function setAiAvatarPreview(dataUrl){
  aiAvatarDataUrl=dataUrl; $('aiAvatarPreview').src=dataUrl; $('aiAvatarPreview').classList.remove('hidden'); $('aiAvatarPlaceholder').classList.add('hidden');
}
async function generateAiAvatar(){
  const file=$('aiAvatarInput').files?.[0];
  if(!file){setAiMsg('Choisis d’abord une photo.','err');return;}
  if(file.size>15*1024*1024){setAiMsg('Photo trop volumineuse (15 Mo maximum).','err');return;}
  setBusy('generateAiAvatarBtn',true,'Génération…'); setAiMsg('Création de ton avatar IA…');
  try{
    const imageData=await fileToDataUrl(file);
    setAiPhotoPreview(imageData);
    const r=await fetch('/api/generate-avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageData})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||'La génération a échoué.');
    if(!data.image) throw new Error('Aucun avatar généré.');
    setAiAvatarPreview(data.image); setAiMsg('Avatar généré ✓ Tu peux maintenant enregistrer ton profil.','ok');
    document.querySelectorAll('.avatarChoice').forEach(b=>b.classList.remove('selected'));
    document.querySelectorAll('.builderChoice').forEach(b=>b.classList.remove('selected'));
  }catch(e){setAiMsg('Erreur : '+(e.message||String(e)),'err');}
  finally{setBusy('generateAiAvatarBtn',false,'✨ Générer mon avatar')}
}
async function dataUrlToBlob(dataUrl){ const r=await fetch(dataUrl); return await r.blob(); }

async function saveProfile(){
if(!user||!sb)return;
const name=$('profileName').value.trim()||user.email.split('@')[0];
const username=$('profileUsername').value.trim()||name;
setBusy('saveProfileBtn',true,'Enregistrement…');
try{
let avatar='';
const current=await sb.from('profiles').select('avatar').eq('id',user.id).maybeSingle();
if(current.error)throw current.error;
avatar=current.data?.avatar||'';
const selectedEmoji=document.querySelector('.avatarChoice.selected')?.dataset.avatar||'';
const file=$('avatarInput').files?.[0];
const customSelected=document.querySelector('.builderChoice.selected');
if(!file){ if(aiAvatarDataUrl){ const blob=await dataUrlToBlob(aiAvatarDataUrl); const path=user.id+'/'+crypto.randomUUID()+'.webp'; const up=await sb.storage.from('profile-avatars').upload(path,blob,{upsert:false,contentType:'image/webp'}); if(up.error)throw up.error; const pu=sb.storage.from('profile-avatars').getPublicUrl(path); avatar=pu.data.publicUrl; } else if(selectedEmoji) avatar=selectedEmoji; else if(customSelected) avatar=customAvatarData(); }
if(file){
if(file.size>10*1024*1024)throw new Error('La photo dépasse 10 Mo.');
if(!file.type.startsWith('image/'))throw new Error('Choisis une image.');
const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'')||'jpg';
const path=user.id+'/'+crypto.randomUUID()+'.'+ext;
const up=await sb.storage.from('profile-avatars').upload(path,file,{upsert:false,contentType:file.type});
if(up.error)throw up.error;
const pu=sb.storage.from('profile-avatars').getPublicUrl(path);
avatar=pu.data.publicUrl;
}
const r=await sb.from('profiles').upsert({id:user.id,display_name:name,username:username,avatar:avatar},{onConflict:'id'}).select().single();
if(r.error)throw r.error;
$('who').textContent=name; renderProfile(r.data); $('avatarInput').value=''; aiAvatarDataUrl=''; $('aiAvatarInput').value=''; setAiMsg('Avatar enregistré ✓','ok');
msg('profileMsg','Profil enregistré ✓','ok');
await loadMembers();
}catch(e){msg('profileMsg','Erreur : '+(e.message||String(e)),'err')}
finally{setBusy('saveProfileBtn',false,'Enregistrer mon profil')}
}

async function show(u){
  user=u;
  window.restoreMyEventCardOrder?.();
  $('auth').classList.add('hidden');
  $('main').classList.remove('hidden');
  $('main').classList.add('mainVisible');
  global('Chargement de tes événements…');

  try{
    const p=await sb.from('profiles').select('*').eq('id',u.id).maybeSingle();
    if(p.error) throw new Error('Profil : '+p.error.message);

    if(!p.data){
      const name=(u.email||'membre').split('@')[0];
      const pr=await sb.from('profiles').upsert({
        id:u.id,display_name:name,username:name
      },{onConflict:'id'}).select().single();
      if(pr.error) throw new Error('Création du profil : '+pr.error.message);
      $('who').textContent=name;
      renderProfile({display_name:name,username:name,avatar:''});
    }else {
      $('who').textContent=p.data.display_name||p.data.username||u.email;
      renderProfile(p.data);
    }

    // V49.4 : connexion = accueil, sauf retour/rechargement de la même session
    // alors qu'un onglet était déjà ouvert.
    event=null;
    const events=await loadEvents();
    await handleJoinLink();

    // Connexion = accueil. En revanche, si la page est simplement rechargée/quittée
    // pendant la même session et qu'un onglet était ouvert, on restaure exactement
    // cet événement et cet onglet. Un changement d'événement efface ce mode.
    const restoreSameView=sessionStorage.getItem('myevent_restore_view')==='1';
    const savedActiveId=localStorage.getItem('myevent_active_'+u.id)||'';
    if(restoreSameView && savedActiveId && events.some(e=>e.id===savedActiveId)){
      await selectEvent(savedActiveId,{restoreView:true});
    }else{
      event=null;
      sessionStorage.removeItem('myevent_restore_view');
    }
    $('ename').value=''; $('place').value='';
    renderEventHero();
    updateInviteUI();
    $('members').innerHTML='<p class="muted">Sélectionne un événement pour voir les participants.</p>';
    $('messages').innerHTML='<p class="muted">Sélectionne un événement pour ouvrir la discussion.</p>';
    $('polls').innerHTML='<p class="muted">Sélectionne un événement pour voir les sondages.</p>';
    $('mediaGrid').innerHTML='<p class="muted">Sélectionne un événement pour voir les souvenirs.</p>';
    global(events.length ? 'Accueil chargé. Choisis un événement pour l’ouvrir.' : 'Aucun événement pour le moment. Crée ou rejoins un groupe.','ok');
  }catch(e){
    global(e.message||String(e),'err');
  }
}

async function loadEvents(){
  const owned=await sb.from('events').select('*').eq('creator_id',user.id).order('created_at',{ascending:false});
  if(owned.error) throw new Error('Événements : '+owned.error.message);

  const memberships=await sb.from('event_members').select('event_id').eq('user_id',user.id);
  if(memberships.error) throw new Error('Groupes : '+memberships.error.message);

  const memberIds=(memberships.data||[]).map(x=>x.event_id).filter(Boolean);
  let memberEvents=[];
  if(memberIds.length){
    const r=await sb.from('events').select('*').in('id',memberIds);
    if(r.error) throw new Error('Groupes : '+r.error.message);
    memberEvents=r.data||[];
  }

  const map=new Map();
  [...(owned.data||[]),...memberEvents].forEach(e=>map.set(e.id,e));
  const events=Array.from(map.values()).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));

  // Le dernier événement reste mémorisé, mais aucune fiche ne s'ouvre automatiquement à la connexion.
  const savedId=event?.id || '';
  $('eventList').innerHTML=events.length ? events.map(e=>{
    const active=e.id===savedId?' active':'';
    const mine=e.creator_id===user.id;
    const leaveOrDelete=mine
      ? '<button type="button" class="deleteEventBtn" data-id="'+e.id+'">🗑️ Supprimer</button>'
      : '<button type="button" class="leaveEventBtn" data-id="'+e.id+'">🚪 Quitter</button>';
    const edit=mine ? '<button type="button" class="editEventListBtn">✏️ Modifier</button>' : '';
    return '<div class="eventCard'+active+'" data-event-id="'+e.id+'">'+
      '<div class="eventCardTop">'+
        '<div class="eventCardTopInfo"><b>'+esc(e.name||'Événement sans nom')+'</b>'+' '+
          '<span>'+esc(e.location||'Lieu non renseigné')+' · '+(mine?'Organisateur':'Participant')+'</span></div>'+
        '<button type="button" class="secondary eventCardCollapse" aria-label="Ouvrir ou réduire l’événement" title="Cliquer sur la carte pour ouvrir ou réduire">⌄</button>'+
        '<button type="button" class="secondary eventCardSettings" aria-label="Actions de l’événement" aria-expanded="false">⚙️</button>'+
      '</div>'+
      '<div class="eventCardCover" data-event-id="'+e.id+'"><div class="eventCardCoverTitle">'+esc(e.name||'Événement')+'</div></div>'+
      '<div class="eventCardMenu hidden">'+
        edit+
        '<button type="button" class="inviteEventListBtn">👥 Inviter</button>'+
        leaveOrDelete+
      '</div>'+
      '</div>';
  }).join('') : '<p class="muted">Aucun groupe pour le moment.</p>';

  // Charge les couvertures visibles de tous les événements sans bloquer l'affichage de la liste.
  await Promise.all(events.map(async e=>{
    const el=document.querySelector('.eventCardCover[data-event-id="'+CSS.escape(String(e.id))+'"]');
    if(!el || !e.cover_url)return;
    try{
      const url=await coverDisplayUrl(e.cover_url);
      if(url) el.style.backgroundImage='url("'+String(url).replace(/"/g,'%22')+'")';
    }catch(_){ }
  }));

  // V54.15 — ouverture événement robuste sur iPhone.
  // Délégation sur #eventList : le gestionnaire reste actif même lorsque les cartes
  // sont reconstruites, et l'erreur éventuelle de selectEvent() est affichée au lieu
  // de donner l'impression que le clic ne fonctionne pas.
  const eventListEl=$('eventList');
  let eventCardClickLockUntil=0;
  if(eventListEl){
    eventListEl.onclick=async ev=>{
      const now=Date.now();
      if(now<eventCardClickLockUntil)return;
      eventCardClickLockUntil=now+450;
      const card=ev.target.closest('.eventCard');
      if(!card || !eventListEl.contains(card))return;
      if(ev.target.closest('.eventCardMenu') || ev.target.closest('.eventCardSettings'))return;
      const id=card.dataset.eventId;
      if(!id)return;
      document.querySelectorAll('.eventCardMenu').forEach(m=>m.classList.add('hidden'));

      // V54.30 — comme les 3 menus repliables du bas :
      // cliquer sur la carte active alterne ouverture / réduction.
      // Cliquer sur une autre carte l'ouvre et la rend active.
      if(event && String(event.id)===String(id)){
        const details=card.querySelector('.inlineEventDetails');
        if(details){
          details.remove();
          card.classList.add('collapsed');
          const arrow=card.querySelector('.eventCardCollapse');
          if(arrow){arrow.textContent='›';arrow.setAttribute('aria-label','Événement réduit — cliquer pour ouvrir');arrow.setAttribute('title','Événement réduit — cliquer pour ouvrir');}
          return;
        }
        card.classList.remove('collapsed');
        try{
          await renderInlineSelectedEvent();
          if(typeof refreshReservationBoxes==='function') await refreshReservationBoxes();
        }catch(e){
          console.error('V54.30 renderInlineSelectedEvent',e);
          global('Impossible d’afficher cet événement : '+(e?.message||String(e)),'err');
        }
        return;
      }

      document.querySelectorAll('.eventCard .inlineEventDetails').forEach(d=>d.remove());
      try{
        await selectEvent(id);
      }catch(e){
        console.error('V54.15 selectEvent',e);
        global('Impossible d’ouvrir cet événement : '+(e?.message||String(e)),'err');
      }
    };
  }
  // V54.32 — suppression du second gestionnaire de clic du bouton ▾/›.
  // Le clic remonte maintenant une seule fois vers eventListEl, qui gère à lui seul
  // l'ouverture/réduction. Cela évite un double toggle sur iPhone.
  document.querySelectorAll('.eventCardSettings').forEach(btn=>btn.addEventListener('click',ev=>{
    ev.stopPropagation();
    const card=btn.closest('.eventCard');
    const menu=card?.querySelector('.eventCardMenu');
    if(!menu)return;
    document.querySelectorAll('.eventCardMenu').forEach(m=>{if(m!==menu)m.classList.add('hidden')});
    const hidden=menu.classList.toggle('hidden');
    btn.setAttribute('aria-expanded',hidden?'false':'true');
  }));
  document.querySelectorAll('.editEventListBtn').forEach(btn=>btn.addEventListener('click',async ev=>{
    ev.stopPropagation(); const card=btn.closest('.eventCard'); try{await selectEvent(card.dataset.eventId); openEventTool('editEventBox');}catch(e){console.error(e);global('Impossible d’ouvrir cet événement : '+(e?.message||String(e)),'err');}
  }));
  document.querySelectorAll('.inviteEventListBtn').forEach(btn=>btn.addEventListener('click',async ev=>{
    ev.stopPropagation(); const card=btn.closest('.eventCard'); try{await selectEvent(card.dataset.eventId); openEventTool('inviteCard');}catch(e){console.error(e);global('Impossible d’ouvrir cet événement : '+(e?.message||String(e)),'err');}
  }));
  document.querySelectorAll('.deleteEventBtn').forEach(btn=>btn.addEventListener('click',ev=>{ev.stopPropagation();deleteEvent(btn.dataset.id)}));
  document.querySelectorAll('.leaveEventBtn').forEach(btn=>btn.addEventListener('click',ev=>{ev.stopPropagation();leaveEvent(btn.dataset.id)}));
  document.addEventListener('click',function closeEventMenus(ev){
    if(!ev.target.closest('.eventCard')) document.querySelectorAll('.eventCardMenu').forEach(m=>m.classList.add('hidden'));
  },{once:true});

  $('eventListMsg').textContent=events.length ? events.length+' événement'+(events.length>1?'s':'') : '';
  if(event && events.some(e=>e.id===event.id)){
    await renderInlineSelectedEvent();
    if(typeof refreshReservationBoxes==='function') await refreshReservationBoxes();
  }
  return events;
}

let inlineEventRenderToken=0;
async function renderInlineSelectedEvent(){
  const renderToken=++inlineEventRenderToken;
  document.querySelectorAll('.eventCard').forEach(card=>card.querySelector('.inlineEventDetails')?.remove());
  if(!event)return;
  const card=document.querySelector('.eventCard[data-event-id="'+CSS.escape(String(event.id))+'"]');
  if(!card)return;
  card.classList.remove('collapsed');
  const collapseBtn=card.querySelector('.eventCardCollapse');
  if(collapseBtn){ collapseBtn.textContent='⌄'; collapseBtn.setAttribute('aria-label','Réduire l’événement actif'); collapseBtn.setAttribute('title','Cliquer sur la carte pour réduire'); }
  const box=document.createElement('div'); box.className='inlineEventDetails';
  // La couverture est déjà affichée par .eventCardCover.
  // Les détails du choix sélectionné ajoutent uniquement les informations complémentaires.
  const meta=document.createElement('div'); meta.className='inlineEventMeta'; meta.textContent=(event.location?'📍 '+event.location+' · ':'')+'📅 '+formatEventDate(event.event_date); box.appendChild(meta);
  const stats=document.createElement('div'); stats.className='inlineEventStats';
  const members=(document.getElementById('memberCount')?.textContent||'').replace(/[^0-9]/g,'')||'0';
  const messages=String(document.querySelectorAll('#messages .messageRow').length);
  const photos=String(document.querySelectorAll('#mediaGrid .mediaItem').length);
  stats.innerHTML='<button type="button" class="inlineEventStat" data-shortcut="members"><b>'+members+'</b><span>Participants</span></button><button type="button" class="inlineEventStat" data-shortcut="discussion"><b>'+messages+'</b><span>Messages</span></button><button type="button" class="inlineEventStat" data-shortcut="media"><b>'+photos+'</b><span>Souvenirs</span></button>'; box.appendChild(stats);
  // Les raccourcis sont créés dynamiquement après le rendu de la liste :
  // on leur attache donc leur action ici, immédiatement après leur création.
  stats.querySelectorAll('.inlineEventStat').forEach(btn=>btn.addEventListener('click',async ev=>{
    ev.preventDefault(); ev.stopPropagation();
    const tab=btn.dataset.shortcut;
    if(!tab)return;
    try{
      await selectEvent(event.id);
      showEventTab(tab,true);
      document.querySelector('.tabPanel[data-panel="'+tab+'"]')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){ alert('Impossible d’ouvrir cette rubrique : '+(e.message||String(e))); }
  }));

  // V57.3 : une décision IA transformée en action doit aussi apparaître
  // directement sur l'accueil de l'événement, et pas uniquement dans la discussion.
  try{
    const aq=await sb.from('messages')
      .select('id,content,created_at')
      .eq('event_id',event.id)
      .like('content','[[MYEVENT_AI_ACTION]]%')
      .order('created_at',{ascending:false})
      .limit(1);
    if(renderToken!==inlineEventRenderToken)return;
    const actionMessage=Array.isArray(aq.data)&&aq.data[0]?aq.data[0]:null;
    if(actionMessage?.content){
      let payload=null;
      try{payload=JSON.parse(actionMessage.content.slice('[[MYEVENT_AI_ACTION]]'.length));}catch(_){ }
      if(payload){
        const actionBox=document.createElement('div');
        actionBox.className='inlineEventAiAction';
        const displayAction=pollActionDisplay(payload.action,payload.choice);
        actionBox.innerHTML='<div class="inlineEventAiActionTitle">⚡ Décision transformée en action</div>'+          '<div class="inlineEventAiActionMain"><b>'+esc(payload.question||'Décision du groupe')+'</b></div>'+          '<div class="inlineEventAiActionChoice">✓ '+esc(payload.choice||'')+'</div>'+          (displayAction?'<div class="inlineEventAiActionText">'+esc(displayAction)+'</div>':'')+          '<div class="inlineEventAiActionStatus">Action validée et publiée dans cet événement</div>';
        box.appendChild(actionBox);
      }
    }
  }catch(_){ }

  // V55 : le planning affiché sur l'accueil de l'événement peut être
  // soit le planning manuel (🍽️ Sorties), soit le planning complet IA (✨ Sortie IA).
  // Le choix est indépendant de la sortie sélectionnée et mémorisé par événement.
  try{
    // V54.20 — après une sélection, outingSelected est la valeur fraîchement
    // choisie par l'utilisateur. Elle doit primer sur une éventuelle ancienne
    // ligne encore présente dans event_outings.
    let outing=null;
    if(outingSelected && String(outingSelected.event_id||event.id)===String(event.id)){
      outing=validSelectedOuting(outingSelected);
    }
    if(!outing) outing=await getScopedEventOuting(event.id);
    if(renderToken!==inlineEventRenderToken)return;

    // Récupère le planning IA sans modifier le fonctionnement de l'onglet ✨ Sortie IA.
    let aiPlan=null, aiItems=[];
    const aiLocalKey=user ? 'myevent_ai_plan_'+user.id+'_'+event.id : '';
    if(aiLocalKey){
      try{
        const raw=localStorage.getItem(aiLocalKey);
        const lp=raw?JSON.parse(raw):null;
        if(lp?.event_id===event.id&&Array.isArray(lp.items)&&lp.items.length){
          aiPlan={id:lp.plan_id||null,event_id:event.id,title:lp.title||'Sortie organisée avec l’IA',people:Number(lp.people)||1,budget_per_person:lp.budget_per_person,request:lp.request||''};
          aiItems=lp.items;
        }
      }catch(_){ }
    }
    if(!aiPlan){
      const aq=await sb.from('event_outing_plans').select('*').eq('event_id',event.id).order('created_at',{ascending:false}).limit(1);
      if(renderToken!==inlineEventRenderToken)return;
      if(!aq.error&&Array.isArray(aq.data)&&aq.data[0]){
        aiPlan=aq.data[0];
        if(aiPlan.id){
          const ar=await sb.from('event_outing_plan_items').select('*').eq('plan_id',aiPlan.id).order('step_order',{ascending:true});
          if(renderToken!==inlineEventRenderToken)return;
          if(!ar.error)aiItems=Array.isArray(ar.data)?ar.data:[];
        }
      }
    }

    const planning=document.createElement('div');
    planning.className='inlineEventPlanning';
    const choiceKey=user ? 'myevent_event_planning_choice_'+user.id+'_'+event.id : '';
    let choice='manual';
    try{ const saved=choiceKey?localStorage.getItem(choiceKey):null; if(saved==='ai'&&aiPlan&&aiItems.length)choice='ai'; }catch(_){ }

    const renderManual=()=>{
      if(!outing){
        return '<div class="planningEmpty">Aucun planning manuel n’est encore créé.</div>'+
          '<div class="planningActions"><button type="button" class="secondary" data-planning-open-outings="1">🍽️ Ajouter une sortie</button></div>';
      }
      const t=String(outing.outing_type||'').toLowerCase();
      const typeLabel=t==='restaurant'?'🍽️ Restaurant':t==='nature'?'🌳 Nature':t==='culture'?'🏛️ Culture':'🎯 Activité';
      const query=encodeURIComponent([outing.name,outing.address||''].filter(Boolean).join(', '));
      const mapsSearch='https://www.google.com/maps/search/?api=1&query='+query;
      const reviewsSearch='https://www.google.com/search?q='+encodeURIComponent([outing.name,outing.address||'','avis'].filter(Boolean).join(' '));
      const destination=outing.lat!=null&&outing.lon!=null?Number(outing.lat)+','+Number(outing.lon):query;
      const mapsDirections='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination);
      return '<div class="inlineEventPlanningStatus">📋 Planning manuel — sortie sélectionnée</div>'+
        '<div class="planningStep"><div class="planningStepIcon">1</div><div><div class="planningStepName">'+esc(outing.name||'Sortie')+'</div><div class="planningStepMeta">'+typeLabel+(outing.address?' · 📍 '+esc(outing.address):'')+(outing.price_per_person!=null?' · 💶 '+eur(outing.price_per_person)+' / pers.':'')+'</div>'+(outing.lat!=null&&outing.lon!=null?'<div class="planningStepMeta">🧭 '+Number(outing.lat).toFixed(6)+' , '+Number(outing.lon).toFixed(6)+'</div>':'')+'</div></div>'+
        '<div class="planningActions"><a class="secondary" href="'+reviewsSearch+'" target="_blank" rel="noopener">⭐ Voir les avis</a><a class="secondary" href="'+mapsDirections+'" target="_blank" rel="noopener">🗺️ Itinéraire</a><button type="button" class="secondary" data-planning-open-outings="1">✏️ Modifier</button><button type="button" class="secondary" data-home-outing-map="1">📍 Localisation</button></div>';
    };
    const renderAi=()=>{
      if(!aiPlan||!aiItems.length)return '<div class="planningEmpty">Aucun planning IA n’est encore créé.</div><div class="planningActions"><button type="button" class="secondary" data-open-ai-planning="1">✨ Organiser une sortie avec l’IA</button></div>';
      return '<div class="inlineEventPlanningStatus">✨ Proposition IA sélectionnée</div>'+
        '<div class="muted" style="margin-bottom:10px">'+esc(aiPlan.title||'Sortie complète')+' · '+esc(String(aiPlan.people||1))+' pers.</div>'+
        aiItems.map((x,i)=>'<div class="planningStep"><div class="planningStepIcon">'+(i+1)+'</div><div><div class="planningStepName">'+esc(x.name||'Étape')+'</div><div class="planningStepMeta">'+aiPlanCandidateLabel(x.outing_type||x.type||'activity')+(x.start_time?' · 🕐 '+esc(x.start_time):'')+(x.address?' · 📍 '+esc(x.address):'')+'</div></div></div>').join('')+
        '<div class="planningActions"><button type="button" class="secondary" data-open-ai-planning="1">✨ Modifier la proposition</button><button type="button" class="secondary" data-ai-plan-remove="1">✕ Retirer la proposition</button></div>';
    };

    planning.innerHTML='<div class="inlineEventPlanningTitle">🎉 Planning de l’événement</div>'+
      '<div class="eventPlanningChooser" role="tablist" aria-label="Choix du planning de l’événement">'+
      '<button type="button" class="secondary eventPlanningChoice '+(choice==='manual'?'active':'')+'" data-event-planning-choice="manual">📋 Manuel</button>'+
      '<button type="button" class="secondary eventPlanningChoice '+(choice==='ai'?'active':'')+'" data-event-planning-choice="ai">✨ IA</button>'+
      '</div>'+
      '<div id="eventPlanningSelectedContent">'+(choice==='ai'?renderAi():renderManual())+'</div>'+
      '<div id="homeAiReservationBox" style="display:'+(choice==='ai'?'block':'none')+'"></div>'+
      '<div id="homeReservationBox" style="display:'+(choice==='manual'?'block':'none')+'"></div>';
    box.appendChild(planning);
    planning.querySelector('[data-ai-plan-remove]')?.addEventListener('click',removeAiOutingPlan);

    // V58.1 — Timeline centrale du planning de l’événement.
    try{ await renderEventPlanningTimeline(box,event,choice,outing,aiPlan,aiItems); }catch(_){ }
    // V58.2 — Transport intégré au planning central.
    try{ await renderEventTransport(box,event); }catch(_){ }
    try{ await renderEventAccommodation(box,event); }catch(_){ }
    // V58.4 — Déplacements locaux entre les étapes.
    try{ await renderEventLocalTravel(box,event,choice,outing,aiPlan,aiItems); }catch(_){ }

    const content=planning.querySelector('#eventPlanningSelectedContent');
    const bindPlanningActions=()=>{
      planning.querySelector('[data-planning-open-outings]')?.addEventListener('click',()=>{showEventTab('outings',true);document.querySelector('.tabPanel[data-panel="outings"]')?.scrollIntoView({behavior:'smooth',block:'start'});});
      planning.querySelector('[data-open-ai-planning]')?.addEventListener('click',()=>{showEventTab('aioutings',true);document.querySelector('.tabPanel[data-panel="aioutings"]')?.scrollIntoView({behavior:'smooth',block:'start'});});
      planning.querySelector('[data-home-outing-map]')?.addEventListener('click',()=>{
        if(!outing||outing.lat==null||outing.lon==null)return;
        showEventTab('locations',true);
        setTimeout(()=>{
          if(typeof setLocationMapView==='function')setLocationMapView(Number(outing.lat),Number(outing.lon),17);
          if(locationMap){
            if(locationOutingMarker)locationMap.removeLayer(locationOutingMarker);
            locationOutingMarker=L.marker([Number(outing.lat),Number(outing.lon)],{icon:makeLocationIcon('🍽️','#278cff')}).addTo(locationMap).bindPopup('<b>🍽️ '+esc(outing.name||'Sortie')+'</b>').openPopup();
          }
          $('locationMap')?.scrollIntoView({behavior:'smooth',block:'center'});
        },180);
      });
    };
    const updateChoice=async(next)=>{
      choice=next;
      try{ if(choiceKey)localStorage.setItem(choiceKey,choice); }catch(_){ }
      planning.querySelectorAll('[data-event-planning-choice]').forEach(b=>b.classList.toggle('active',b.dataset.eventPlanningChoice===choice));

      // V54.17 — Quand l'utilisateur revient sur « Manuel », ne pas utiliser
      // le snapshot capturé lors du rendu initial. Une sortie peut avoir été
      // ajoutée après ce rendu (depuis le module Sorties). On relit donc la
      // sélection directement depuis Supabase avant de construire le contenu.
      if(choice==='manual'){
        try{
          const freshOuting=await getScopedEventOuting(event.id);
          outing=freshOuting;
        }catch(_){
          outing=null;
        }
      }

      if(content)content.innerHTML=choice==='ai'?renderAi():renderManual();
      const manualBox=planning.querySelector('#homeReservationBox');
      const aiBox=planning.querySelector('#homeAiReservationBox');
      if(manualBox)manualBox.style.display=choice==='manual'?'block':'none';
      if(aiBox)aiBox.style.display=choice==='ai'?'block':'none';
      bindPlanningActions();

      // Sans planning IA, le bouton IA sert à ouvrir directement le module de création.
      if(next==='ai'&&(!aiPlan||!aiItems.length)){
        try{showEventTab('aioutings',true);}catch(_){ }
        setTimeout(()=>document.querySelector('.tabPanel[data-panel="aioutings"]')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
        return;
      }
      const oldTimeline=box.querySelector('#eventPlanningTimeline');
      if(oldTimeline)oldTimeline.remove();
      try{ await renderEventPlanningTimeline(box,event,choice,outing,aiPlan,aiItems); }catch(_){ }
      if(choice==='ai'){
        if(manualBox)manualBox.innerHTML='';
        if(typeof renderAiPlanReservations==='function'&&aiPlan&&aiItems.length)await renderAiPlanReservations(aiPlan,aiItems,'homeAiReservationBox');
      }else{
        if(aiBox)aiBox.innerHTML='';
        if(typeof refreshReservationBoxes==='function')await refreshReservationBoxes();
      }
    };
    planning.querySelectorAll('[data-event-planning-choice]').forEach(btn=>btn.addEventListener('click',()=>updateChoice(btn.dataset.eventPlanningChoice)));
    bindPlanningActions();
    if(choice==='ai'&&typeof renderAiPlanReservations==='function'&&aiPlan&&aiItems.length){
      renderAiPlanReservations(aiPlan,aiItems,'homeAiReservationBox');
    }else if(choice==='manual'){
      // V54.16 — Le contenu manuel vient d'être rendu avec le snapshot
      // fraîchement lu depuis Supabase. Ne pas rappeler updateChoice(choice)
      // ici : cet appel asynchrone pouvait réécrire le planning avec un état
      // obsolète pendant qu'une nouvelle sélection venait d'être enregistrée.
      bindPlanningActions();
    }
  }catch(_){ }

  card.appendChild(box);
}

async function selectEvent(id, options={}){
  if(!id)return;
  const restoreView=options?.restoreView===true;
  // Lors d'un changement d'événement, aucun détail de l'ancien ne doit rester visible.
  document.querySelectorAll('.eventCard .inlineEventDetails').forEach(d=>d.remove());
  const r=await sb.from('events').select('*').eq('id',id).maybeSingle();
  if(r.error) throw new Error('Sélection de l’événement : '+r.error.message);
  if(!r.data) throw new Error('Cet événement n’est plus accessible.');

  // V54.21 — Ne pas effacer l'état de la sortie lorsque l'utilisateur
  // rouvre le MÊME événement depuis sa carte. Le retour à la carte d'accueil
  // passait auparavant par selectEvent(id), puis resetOutingModuleState(),
  // ce qui supprimait outingSelected avant le rendu du planning.
  // Un vrai changement d'événement conserve au contraire l'isolation stricte.
  const sameEvent=String(event?.id||'')===String(id);
  if(!sameEvent){
    resetOutingModuleState();
    resetAiModuleState();
  }

  if(callActive && !sameEvent) await stopGroupCall();
  event=r.data;
  localStorage.setItem('myevent_active_'+user.id,event.id);
  localStorage.setItem('myevent_last_event_'+user.id,event.id);
  // Les champs du formulaire « Créer un événement » restent indépendants
  // de l’événement actuellement sélectionné.
  renderEventHero();
  updateInviteUI();
  await initializeUnreadMarkers();

  document.querySelectorAll('.eventCard').forEach(c=>c.classList.toggle('active',c.dataset.eventId===event.id));

  // V54.26 — l'événement actif est la seule source de vérité pour Sortie + Réservation.
  // À chaque ouverture/reconnexion, on recharge explicitement la sélection de CET événement
  // avant de construire le Planning. Un nouvel événement arrive donc naturellement sans sélection.
  if(typeof loadSelectedOuting==='function'){
    try{ await loadSelectedOuting(); }catch(e){ console.error('loadSelectedOuting active event',e); }
  }
  currentReservation=null;
  if(typeof loadEventReservation==='function'){
    try{ await loadEventReservation(); }catch(e){ console.error('loadEventReservation active event',e); }
  }

  // V54.32 — Un seul gestionnaire de clic + verrou anti-double-tap.
  // V54.31 — Un seul rendu de l'événement à l'ouverture.
  // Le double render ici provoquait le flash : ouverture → fermeture → réouverture.
  // renderInlineSelectedEvent() sera exécuté une seule fois après le chargement
  // complet ci-dessous, qui reste la source de vérité du DOM.
  global('Événement actif : '+event.name,'ok');

  // Changer d'événement doit toujours ramener à l'accueil de cet événement.
  // La restauration d'un onglet n'est autorisée que lors d'un retour/rechargement
  // de la page avec la même session, jamais après une sélection normale.
  let restoredTab=null;
  if(!restoreView){
    sessionStorage.removeItem('myevent_restore_view');
    document.body.classList.remove('discussionFullScreen');
    document.querySelectorAll('.eventTab').forEach(btn=>{
      btn.classList.remove('active');
      btn.setAttribute('aria-selected','false');
    });
    document.querySelectorAll('.tabPanel').forEach(panel=>{
      panel.classList.remove('active');
      panel.open=false;
    });
  }else{
    const savedTab=localStorage.getItem('myevent_active_tab_'+user.id+'_'+event.id)||'discussion';
    restoredTab=['discussion','polls','media','locations','fund','hall','aioutings'].includes(savedTab)?savedTab:'discussion';
    showEventTab(restoredTab,true);
  }
  // Recharge le thème de discussion propre à l'utilisateur et à l'événement.
  if(typeof window.loadMyEventChatStyle==='function') await window.loadMyEventChatStyle();
  await Promise.all([loadMessages(),loadPolls(),loadMembers(),loadMedia(),loadFund()]);
  if(restoredTab==='locations') await loadEventLocations();
  await renderInlineSelectedEvent();
  // V53.10 : second/final render = source of truth for the DOM.
  await refreshReservationBoxes();
  if(!restoreView){
    // Sécurité : un changement d'événement ne doit jamais ouvrir automatiquement Discussion.
    document.body.classList.remove('discussionFullScreen');
    document.querySelectorAll('.eventTab').forEach(btn=>{btn.classList.remove('active');btn.setAttribute('aria-selected','false')});
    document.querySelectorAll('.tabPanel').forEach(panel=>{panel.classList.remove('active');panel.open=false});
  }
  // Réapplique le thème après le rendu complet : aucune reconnexion ne doit
  // pouvoir remplacer le fond choisi par le fond par défaut.
  if(typeof window.loadMyEventChatStyle==='function'){
    window.loadMyEventChatStyle();
    setTimeout(()=>window.loadMyEventChatStyle?.(),250);
    setTimeout(()=>window.loadMyEventChatStyle?.(),900);
  }
  await loadWeather();
  await refreshNotifications(false);
  $('statMembers').textContent=$('memberCount').textContent.replace(/[^0-9]/g,'')||'0';
  $('statMessages').textContent=document.querySelectorAll('#messages .messageRow').length;
  $('statPhotos').textContent=document.querySelectorAll('#mediaGrid .mediaItem').length;
  subscribeRealtime();
}

function updateInviteUI(){
  if(!event)return;
  const code=event.invite_code||'';
  if(code){
    const link=location.origin+location.pathname+'?join='+encodeURIComponent(code);
    $('inviteLink').value=link;
  }else{
    $('inviteLink').value='';
  }
}

async function deleteEvent(id){
  if(!user||!sb||!id)return;
  const target=document.querySelector('.eventCard[data-event-id="'+id+'"] b')?.textContent||'cet événement';
  if(!confirm('Supprimer définitivement « '+target+' » ?\n\nLes messages, sondages, participants et médias liés seront supprimés. Cette action est irréversible.')) return;

  const btn=document.querySelector('.deleteEventBtn[data-id="'+id+'"]');
  if(btn){btn.disabled=true;btn.textContent='Suppression…';}
  try{
    // On tente aussi de supprimer les fichiers médias du stockage.
    const mr=await sb.from('media').select('storage_path').eq('event_id',id);
    if(!mr.error && (mr.data||[]).length){
      await sb.storage.from('event-media').remove((mr.data||[]).map(x=>x.storage_path).filter(Boolean));
    }

    const r=await sb.rpc('delete_event',{p_event_id:id});
    if(r.error) throw r.error;

    if(event?.id===id){
      if(realtimeChannel){await sb.removeChannel(realtimeChannel);realtimeChannel=null;}
      event=null;
      localStorage.removeItem('myevent_active_'+user.id);
      $('ename').value=''; $('place').value=''; $('inviteLink').value='';
    }
    await loadEvents();
    const remaining=await sb.from('events').select('id').eq('creator_id',user.id).limit(1);
    const saved=localStorage.getItem('myevent_active_'+user.id);
    if(!event && !remaining.error && remaining.data?.length) await selectEvent(remaining.data[0].id);
    else if(!event){
      $('members').innerHTML='<p class="muted">Aucun événement sélectionné.</p>';
      $('messages').innerHTML='<p class="muted">Crée ou rejoins un événement pour commencer.</p>';
      $('polls').innerHTML='<p class="muted">Aucun événement sélectionné.</p>';
      $('mediaGrid').innerHTML='<p class="muted">Aucun événement sélectionné.</p>';
    }
    global('Événement supprimé.','ok');
  }catch(e){
    global('Suppression impossible : '+(e.message||String(e)),'err');
    if(btn){btn.disabled=false;btn.textContent='Supprimer';}
  }
}

async function leaveEvent(id){
  if(!user||!sb||!id)return;
  const target=document.querySelector('.eventCard[data-event-id="'+id+'"] b')?.textContent||'cet événement';
  if(!confirm('Quitter « '+target+' » ?\n\nTu ne recevras plus les nouveautés de cet événement. Tu pourras le rejoindre à nouveau avec son lien d’invitation.')) return;
  const btn=document.querySelector('.leaveEventBtn[data-id="'+id+'"]');
  if(btn){btn.disabled=true;btn.textContent='Quitter…';}
  try{
    const r=await sb.rpc('leave_event',{p_event_id:id});
    if(r.error) throw r.error;
    if(event?.id===id){
      if(realtimeChannel){await sb.removeChannel(realtimeChannel);realtimeChannel=null;}
      if(notificationPollTimer) {clearInterval(notificationPollTimer);notificationPollTimer=null;}
      event=null;
      localStorage.removeItem('myevent_active_'+user.id);
      $('eventHeroCard').classList.add('hidden');
      $('eventActions').classList.add('hidden');
      $('editEventBox').classList.add('hidden');
      $('inviteCard').classList.add('hidden');
      $('inviteLink').value='';
      $('members').innerHTML='<p class="muted">Aucun événement sélectionné.</p>';
      $('messages').innerHTML='<p class="muted">Crée ou rejoins un événement pour commencer.</p>';
      $('polls').innerHTML='<p class="muted">Aucun événement sélectionné.</p>';
      $('mediaGrid').innerHTML='<p class="muted">Aucun événement sélectionné.</p>';
    }
    await loadEvents();
    global('Tu as quitté l’événement.','ok');
  }catch(e){
    global('Impossible de quitter : '+(e.message||String(e)),'err');
    if(btn){btn.disabled=false;btn.textContent='Quitter';}
  }
}

async function copyInvite(){
  if(!event?.invite_code){msg('inviteMsg','Aucun code d’invitation pour cet événement.','err');return}
  const link=location.origin+location.pathname+'?join='+encodeURIComponent(event.invite_code);
  try{
    await navigator.clipboard.writeText(link);
    msg('inviteMsg','Lien copié. Tu peux l’envoyer à tes invités.','ok');
  }catch(e){
    $('inviteLink').select();
    msg('inviteMsg','Sélectionne le lien puis copie-le.','muted');
  }
}

async function shareInvite(){
  if(!event?.invite_code)return;
  const link=location.origin+location.pathname+'?join='+encodeURIComponent(event.invite_code);
  try{
    if(navigator.share){
      await navigator.share({title:'Rejoins mon événement MyEvent',text:'Rejoins mon événement sur MyEvent',url:link});
    }else await copyInvite();
  }catch(e){ if(e?.name!=='AbortError') msg('inviteMsg',e.message||String(e),'err'); }
}

async function joinEvent(code){
  code=(code||'').trim();
  if(!code){msg('joinMsg','Entre un code d’invitation.','err');return}
  if(!user||!sb){msg('joinMsg','Connecte-toi d’abord.','err');return}
  setBusy('joinBtn',true,'Connexion…');
  try{
    const r=await sb.rpc('join_event_by_code',{p_code:code});
    if(r.error)throw r.error;
    const row=r.data?.[0];
    if(!row)throw new Error('Événement introuvable.');
    const joinedId=row.joined_event_id ?? row.event_id;
    $('joinCode').value='';
    msg('joinMsg','Événement rejoint : '+(row.event_name||'Événement'),'ok');
    // Ce nouvel abonnement appartient à cet appareil. Un autre appareil
    // connecté au même compte pourra donc recevoir la notification.
    const jm=await sb.from('event_members').select('user_id,joined_at').eq('event_id',joinedId).eq('user_id',user.id).order('joined_at',{ascending:false}).limit(1).maybeSingle();
    if(!jm.error && jm.data?.joined_at) rememberLocalCreated('members',user.id+'|'+jm.data.joined_at);
    await loadEvents();
    await selectEvent(joinedId);
  }catch(e){msg('joinMsg','Erreur : '+(e.message||String(e)),'err')}
  finally{setBusy('joinBtn',false,'Rejoindre')}
}

async function handleJoinLink(){
  const code=new URLSearchParams(location.search).get('join');
  if(code){
    $('joinCode').value=code;
    msg('joinMsg','Lien d’invitation détecté. Appuie sur « Rejoindre ».','ok');
  }
}

function toLocalDateTime(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
function formatEventDate(value){
  if(!value)return 'Date à définir';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return 'Date à définir';
  return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
function updateCountdown(){
  if(!event?.event_date){$('eventCountdown').textContent='';return;}
  const diff=new Date(event.event_date).getTime()-Date.now();
  if(diff<=0){$('eventCountdown').textContent='🎉 C’est aujourd’hui !';return;}
  const total=Math.floor(diff/1000), days=Math.floor(total/86400), hours=Math.floor(total%86400/3600), mins=Math.floor(total%3600/60);
  $('eventCountdown').textContent=days>0?'⏳ Dans '+days+' j '+hours+' h':hours>0?'⏳ Dans '+hours+' h '+mins+' min':'⏳ Dans '+mins+' min';
}
let countdownTimer=null;
async function uploadEventCover(file){
  if(!file || !event || !user) return null;
  if(!file.type.startsWith('image/')) throw new Error('Choisis une image.');
  if(file.size>15*1024*1024) throw new Error('La photo de couverture doit faire moins de 15 Mo.');
  const ext=(file.type.split('/')[1]||'jpg').replace('jpeg','jpg');
  const path=event.id+'/'+user.id+'/cover-'+crypto.randomUUID()+'.'+ext;
  const up=await sb.storage.from('event-media').upload(path,file,{upsert:false,contentType:file.type});
  if(up.error) throw up.error;
  return path;
}
async function coverDisplayUrl(value){
  if(!value) return '';
  if(/^https?:\/\//i.test(value) || /^data:/i.test(value)) return value;
  const r=await sb.storage.from('event-media').createSignedUrl(value,60*60*24);
  return r.error ? '' : (r.data?.signedUrl||'');
}
async function refreshEventCover(){
  if(!event)return;
  const value=event.cover_url||'';
  const url=await coverDisplayUrl(value);
  if(event?.cover_url!==value)return;
  $('eventCover').classList.toggle('hasImage',!!url);
  $('eventCover').style.backgroundImage=url?'url("'+String(url).replace(/"/g,'%22')+'")':'';
}
function renderEventHero(){
  if(!event){$('eventHeroCard').classList.add('hidden');$('editEventBox').classList.add('hidden');$('inviteCard').classList.add('hidden');return;}
  // V49.4 : la fiche de l’événement est intégrée à sa carte dans « Mes événements ».
  $('eventHeroCard').classList.add('hidden');
  $('eventHeroCard').open=false;
  $('editEventBox').classList.add('hidden');
  $('inviteCard').classList.add('hidden');
  $('eventHeroName').textContent=event.name||'Événement';
  $('eventHeroSummaryText').textContent=event.name||'Mon événement';
  $('eventHeroMeta').textContent=(event.location?'📍 '+event.location+' · ':'')+'📅 '+formatEventDate(event.event_date);
  $('eventDescription').textContent=event.description||'';
  $('eventDescription').classList.toggle('hidden',!event.description);
  const cover=event.cover_url||'';
  $('eventCover').classList.toggle('hasImage',false);
  $('eventCover').style.backgroundImage='';
  refreshEventCover();
  const mine=event.creator_id===user.id;
  $('eventActions').classList.remove('hidden');
  $('editEventToggle').classList.toggle('hidden',!mine);
  $('leaveEventBtn').classList.toggle('hidden',mine);
  $('editEventBox').classList.add('hidden');
  if(mine){
    $('editEventName').value=event.name||'';
    if($('editEventType'))$('editEventType').value=event.event_type||'general';
    $('editEventDate').value=toLocalDateTime(event.event_date);
    $('editEventPlace').value=event.location||'';
    $('editEventDescription').value=event.description||'';
    $('editEventCoverFile').value='';
    $('editEventCoverFileName').textContent='';
    updateEditCoverPreview();
  }
  updateCountdown();
  if(!countdownTimer)countdownTimer=setInterval(updateCountdown,30000);
}
async function updateEditCoverPreview(){
  const url=await coverDisplayUrl(event?.cover_url||'');
  $('editCoverPreview').classList.toggle('hidden',!url);
  $('editCoverPreview').style.backgroundImage=url?'url("'+url.replace(/"/g,'%22')+'")':'';
}
async function saveEvent(){
  if(!event||event.creator_id!==user.id)return;
  const name=$('editEventName').value.trim();
  if(!name){msg('editEventMsg','Indique un nom d’événement.','err');return}
  setBusy('saveEventBtn',true,'Enregistrement…');
  try{
    let coverPath=event.cover_url||null;
    const coverFile=$('editEventCoverFile').files?.[0];
    if(coverFile){
      coverPath=await uploadEventCover(coverFile);
    }
    const r=await sb.from('events').update({
      name,
      description:$('editEventDescription').value.trim()||null,
      location:$('editEventPlace').value.trim()||null,
      event_date:$('editEventDate').value?new Date($('editEventDate').value).toISOString():null,
      event_type:$('editEventType')?.value||'general',
      cover_url:coverPath
    }).eq('id',event.id).select().single();
    if(r.error)throw r.error;
    event=r.data;
    $('ename').value=event.name||'';$('place').value=event.location||'';
    renderEventHero();
    await loadEvents();
    msg('editEventMsg','Événement modifié ✓','ok');
    global('Les informations de l’événement sont à jour.','ok');
  }catch(e){msg('editEventMsg','Erreur : '+(e.message||String(e)),'err')}
  finally{setBusy('saveEventBtn',false,'💾 Enregistrer les modifications')}
}
async function createEvent(){
  if(!user || !sb){msg('eventmsg','Pas connecté à Supabase.','err');return}
  const n=$('ename').value.trim(), place=$('place').value.trim(), description=$('eventDescriptionInput').value.trim();
  const coverFile=$('eventCoverFileInput').files?.[0];
  if(!n){msg('eventmsg','Indique un nom d’événement.','err');return}
  setBusy('eventBtn',true,'Création…');
  try{
    const r=await sb.from('events').insert({
      creator_id:user.id,name:n,location:place||null,description:description||null,
      event_date:$('eventDate').value?new Date($('eventDate').value).toISOString():null,
      event_type:$('eventType')?.value||'general',cover_url:null
    }).select().single();
    if(r.error) throw r.error;
    event=r.data;

    // V54.10 — un événement nouvellement créé doit toujours démarrer vierge.
    // Nettoyage défensif : aucun ancien planning IA ne doit pouvoir être associé
    // au nouvel event_id avant sa première utilisation de l'IA.
    try{
      await sb.from('event_outing_plan_items').delete().eq('event_id',event.id);
      await sb.from('event_outing_plans').delete().eq('event_id',event.id);
    }catch(_){ }
    try{
      localStorage.removeItem('myevent_ai_plan_'+user.id+'_'+event.id);
      localStorage.removeItem('myevent_event_planning_choice_'+user.id+'_'+event.id);
    }catch(_){ }

    const m=await sb.from('event_members').upsert({event_id:event.id,user_id:user.id,role:'owner'},{onConflict:'event_id,user_id'});
    if(m.error) throw m.error;
    if(coverFile){
      const coverPath=await uploadEventCover(coverFile);
      const ur=await sb.from('events').update({cover_url:coverPath}).eq('id',event.id).select().single();
      if(ur.error) throw ur.error;
      event=ur.data;
    }
    // V54.12 — couper proprement l'ancien état avant de recharger la liste.
    // Ainsi aucun planning/sortie/réservation de l'événement précédent ne peut
    // être rendu pendant la transition vers le nouvel événement.
    const newEvent=event;
    try{ clearLocalOutingSnapshot(newEvent.id); clearLocalReservationSnapshot(newEvent.id); }catch(_){}
    event=null;
    resetOutingModuleState();
    resetAiModuleState();
    currentReservation=null;

    msg('eventmsg','Événement créé : '+newEvent.name,'ok');
    $('ename').value='';
    $('eventDescriptionInput').value='';
    $('eventDate').value='';
    if($('eventType'))$('eventType').value='general';
    $('place').value='';
    $('eventCoverFileInput').value='';
    $('eventCoverFileName').textContent='';
    $('locationHint').textContent='Tu peux saisir une adresse, un lieu ou utiliser ta position.';
    $('createLocationMap').classList.add('hidden');
    $('createLocationMapFrame').src='about:blank';
    $('createLocationMapLink').href='#';
    $('createEventCard').open=false;
    await loadEvents();
    await selectEvent(newEvent.id);
    resetCreateEventForm();
    $('createEventCard').open=false;
  }catch(e){msg('eventmsg','Erreur : '+(e.message||String(e)),'err')}
  finally{setBusy('eventBtn',false,'Créer')}
}

function eur(v){ return Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}); }
function fundIsOrganizer(){ return !!(event&&user&&event.creator_id===user.id); }
function fundManagerId(settings){ return settings?.manager_user_id || event?.creator_id || null; }
function fundIsManager(settings){ return !!(event&&user&&(event.creator_id===user.id || settings?.manager_user_id===user.id)); }
function fundSetFormOpen(open){ const box=$('fundOrganizerBox'); if(box) box.classList.toggle('hidden',!open); }
function fundContributionFormOpen(open){ $('fundContributionForm')?.classList.toggle('hidden',!open); if(!open){$('fundContributionAmount').value='';$('fundContributionNote').value='';} }
async function startStripePayment(){
  if(!event||!user||!sb)return;
  const btn=$('fundMyPaymentBtn'), msgBox=$('fundMyPaymentMsg'), amountInput=$('fundMyPaymentAmount');
  if(!btn||!amountInput)return;
  const amount=Math.round(Number(String(amountInput.value||'').replace(',','.'))*100)/100;
  const remaining=Math.round(Number(amountInput.max||0)*100)/100;
  if(!(amount>=0.50)){ if(msgBox)msgBox.textContent='Erreur : le montant minimum est de 0,50 €.'; amountInput.focus(); return; }
  if(remaining>0 && amount>remaining+0.005){ if(msgBox)msgBox.textContent='Erreur : le montant ne peut pas dépasser '+eur(remaining)+'.'; amountInput.focus(); return; }
  btn.disabled=true; if(msgBox)msgBox.textContent='Préparation du paiement sécurisé…';
  let fundEntryId=null;
  try{
    const sessionRes=await sb.auth.getSession();
    const accessToken=sessionRes?.data?.session?.access_token;
    if(!accessToken) throw new Error('Session utilisateur introuvable.');

    // Créer la participation en attente AVANT d’ouvrir Stripe.
    // Le webhook utilisera cet ID pour confirmer exactement cette participation.
    const entryRes=await sb.from('event_fund_entries').insert({
      event_id:event.id,
      user_id:user.id,
      entry_type:'contribution',
      amount,
      label:'Participation',
      note:'Paiement Stripe — en attente de confirmation',
      status:'pending'
    }).select('id').single();
    if(entryRes.error) throw new Error('Impossible de créer la participation : '+entryRes.error.message);
    fundEntryId=entryRes.data?.id||null;
    if(!fundEntryId) throw new Error('Identifiant de participation introuvable.');

    const r=await fetch('/api/create-payment-session',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+accessToken
      },
      body:JSON.stringify({
        event_id:event.id,
        fund_entry_id:fundEntryId,
        user_id:user.id,
        origin:location.origin,
        amount
      })
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Impossible de créer le paiement.');
    if(data.already_paid){
      await sb.from('event_fund_entries').delete().eq('id',fundEntryId).eq('event_id',event.id).eq('user_id',user.id).eq('status','pending');
      fundEntryId=null;
      if(msgBox)msgBox.textContent='Ta participation est déjà confirmée.';
      await loadFund();
      return;
    }
    if(!data.url)throw new Error('Stripe n’a pas fourni de lien de paiement.');
    window.location.href=data.url;
  }catch(e){
    // Si la session Stripe n’a pas pu être créée, ne pas laisser une participation fantôme.
    if(fundEntryId){
      await sb.from('event_fund_entries').delete().eq('id',fundEntryId).eq('event_id',event.id).eq('user_id',user.id).eq('status','pending');
    }
    if(msgBox)msgBox.textContent='Erreur : '+(e.message||String(e));
    btn.disabled=false;
  }
}

function renderMyStripePayment(entries,target,memberCount){
  const card=$('fundMyPaymentCard'), amountInput=$('fundMyPaymentAmount'), status=$('fundMyPaymentStatus'), btn=$('fundMyPaymentBtn'), msgBox=$('fundMyPaymentMsg'), recommended=$('fundMyPaymentRecommended'), remainingBox=$('fundMyPaymentRemaining');
  if(!card||!amountInput||!status||!btn)return;
  // Si l'objectif manuel n'est pas encore enregistré, utiliser l'estimation
  // de la cagnotte intelligente calculée depuis le planning.
  let budgetForPayment=Number(target||0);
  if(!(budgetForPayment>0)){
    const smartText=String($('fundSmartEstimate')?.textContent||'');
    const smartMatch=smartText.replace(/\s/g,'').replace('€','').replace(',','.').match(/[0-9]+(?:\.[0-9]+)?/);
    const smartEstimate=smartMatch?Number(smartMatch[0]):0;
    if(Number.isFinite(smartEstimate)&&smartEstimate>0) budgetForPayment=smartEstimate;
  }
  const expected=memberCount>0?Math.round((budgetForPayment/memberCount)*100)/100:0;
  const mine=(entries||[]).filter(x=>x.entry_type==='contribution'&&x.user_id===user.id);
  const confirmed=mine.filter(x=>(x.status||'pending')==='confirmed').reduce((a,x)=>a+Number(x.amount||0),0);
  const pending=mine.filter(x=>(x.status||'pending')==='pending').reduce((a,x)=>a+Number(x.amount||0),0);
  const due=Math.max(0,Math.round((expected-confirmed)*100)/100);
  const recommendedAmount=expected;
  if(recommended)recommended.textContent=expected>0?'Montant recommandé : '+eur(recommendedAmount):'Montant recommandé : —';
  if(remainingBox)remainingBox.textContent=expected>0?'Reste à payer : '+eur(due):'Reste à payer : —';
  amountInput.min='0.50';
  amountInput.max=due>0?due.toFixed(2):'0';
  amountInput.step='0.01';
  if(expected>0 && !amountInput.value) amountInput.value=due.toFixed(2);
  if(expected<=0){
    amountInput.value=''; amountInput.disabled=true; status.className='fundStatus fundPending'; status.textContent='🟠 En attente'; btn.disabled=true;
    if(msgBox)msgBox.textContent='Définis d’abord le budget de l’événement pour calculer ta participation.';
    return;
  }
  if(confirmed>=expected-0.005){
    amountInput.value='0.00'; amountInput.disabled=true; status.className='fundStatus fundConfirmed'; status.textContent='🟢 Payé'; btn.disabled=true;
    if(msgBox)msgBox.textContent='Ma participation est confirmée dans la cagnotte.'; return;
  }
  if(pending>0){
    amountInput.disabled=true; status.className='fundStatus fundPending'; status.textContent='🟠 En attente'; btn.disabled=true;
    if(msgBox)msgBox.textContent='Une participation est déjà en attente de confirmation. Si tu viens de payer par carte, la confirmation peut prendre quelques secondes.'; return;
  }
  amountInput.disabled=false; status.className='fundStatus fundPending'; status.textContent='🔵 À payer'; btn.disabled=!(due>=0.50);
  if(msgBox)msgBox.textContent='Choisis le montant que tu souhaites verser (minimum 0,50 €), puis paie par carte.';
}


function fundExpenseFormOpen(open){ $('fundExpenseForm')?.classList.toggle('hidden',!open); if(!open){$('fundExpenseAmount').value='';$('fundExpenseLabel').value='';} }
function fundPaymentFormOpen(open){ $('fundPaymentForm')?.classList.toggle('hidden',!open); if(!open) $('fundPaymentMsg').textContent=''; }
function normalizeIban(v){ return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function formatIban(v){ const x=normalizeIban(v); return x.replace(/(.{4})/g,'$1 ').trim(); }
function maskIban(v){ const x=normalizeIban(v); return x.length>8 ? x.slice(0,4)+' •• •••• •••• •••• '+x.slice(-4) : x; }
async function loadFundMembers(selectedId){
  const sel=$('fundManagerSelect'); if(!sel||!event)return;
  const r=await sb.from('event_members').select('user_id,nickname').eq('event_id',event.id).order('joined_at',{ascending:true});
  const members=r.data||[];
  const ids=members.map(m=>m.user_id).filter(Boolean); let profiles=[];
  if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids); if(!pr.error)profiles=pr.data||[];}
  const pmap=new Map(profiles.map(p=>[p.id,p]));
  sel.innerHTML='<option value="">Organisateur de l’événement</option>' + members.filter(m=>m.user_id!==event.creator_id).map(m=>{
    const p=pmap.get(m.user_id)||{}; const name=m.nickname||p.display_name||p.username||'Membre';
    return '<option value="'+esc(m.user_id)+'">'+esc(name)+'</option>';
  }).join('');
  if(selectedId && members.some(m=>m.user_id===selectedId)) sel.value=selectedId;
}
async function loadFundPayment(settings){
  const status=$('fundPaymentStatus'), details=$('fundPaymentDetails'), edit=$('editFundPaymentBtn');
  if(!status||!details||!edit||!event||!user)return;
  const managerId=fundManagerId(settings);
  const pr=await sb.from('event_fund_payment_details').select('account_holder,iban,bic,payment_note,updated_at').eq('event_id',event.id).maybeSingle();
  if(pr.error && !String(pr.error.message||'').includes('does not exist')){status.textContent='Impossible de charger les coordonnées.'; details.classList.add('hidden'); return;}
  const d=pr.data;
  edit.classList.toggle('hidden',!fundIsManager(settings));
  if(!d || !d.iban){
    status.textContent=managerId===user.id?'Configure tes coordonnées bancaires pour recevoir les virements.':'Le responsable n’a pas encore configuré les coordonnées bancaires.';
    details.classList.add('hidden');
    if(fundIsManager(settings)) edit.textContent='🏦 Configurer les coordonnées';
    return;
  }
  status.textContent='Coordonnées configurées pour le responsable de la cagnotte.';
  details.innerHTML='<div class="fundPaymentRow"><span>Responsable</span><b>'+(managerId===user.id?'Moi':'Responsable de la cagnotte')+'</b></div>'+
    '<div class="fundPaymentRow"><span>Titulaire</span><b>'+esc(d.account_holder||'—')+'</b></div>'+
    '<div class="fundPaymentRow"><span>IBAN</span><b class="fundPaymentIban">'+esc(maskIban(d.iban))+'</b></div>'+
    (d.bic?'<div class="fundPaymentRow"><span>BIC</span><b>'+esc(d.bic)+'</b></div>':'')+
    (d.payment_note?'<div style="margin-top:8px"><span class="muted">Instruction</span><div>'+esc(d.payment_note)+'</div></div>':'')+
    '<button type="button" id="copyFundIbanBtn" class="secondary" style="margin-top:10px">📋 Copier l’IBAN</button>';
  details.classList.remove('hidden');
  if(fundIsManager(settings)) edit.textContent='⚙️ Modifier les coordonnées';
  $('copyFundIbanBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(normalizeIban(d.iban));status.textContent='IBAN copié dans le presse-papiers.';}catch(e){status.textContent='Copie impossible sur cet appareil.';}});
}
async function openFundPaymentForm(){
  if(!event||!user)return;
  const r=await sb.from('event_fund_payment_details').select('account_holder,iban,bic,payment_note').eq('event_id',event.id).maybeSingle();
  if(r.error && !String(r.error.message||'').includes('does not exist')){msg('fundPaymentMsg','Erreur : '+r.error.message,'err');return;}
  const d=r.data||{};
  $('fundAccountHolder').value=d.account_holder||''; $('fundIban').value=d.iban?formatIban(d.iban):''; $('fundBic').value=d.bic||''; $('fundPaymentNote').value=d.payment_note||'';
  fundPaymentFormOpen(true);
}
async function calculateSmartFund(opts={}){
  if(!event||!user||!sb)return;
  const silent=!!opts.silent;
  const btn=$('fundSmartCalculateBtn'), msgBox=$('fundSmartMsg');
  if(!silent && btn){btn.disabled=true;btn.textContent='⏳ Calcul…';}
  if(msgBox && !silent)msgBox.textContent='Lecture du planning sélectionné…';
  try{
    const membersRes=await sb.from('event_members').select('user_id',{count:'exact',head:true}).eq('event_id',event.id);
    const members=Math.max(1,Number(membersRes.count||0));

    let choice='manual';
    const choiceKey='myevent_event_planning_choice_'+user.id+'_'+event.id;
    try{
      const saved=localStorage.getItem(choiceKey);
      if(saved==='ai')choice='ai';
      else if(saved==='manual')choice='manual';
    }catch(_){ }

    let prices=[];
    let items=[];
    let knownCount=0;
    let missingCount=0;
    let planTitle='';

    if(choice==='ai'){
      let plan=null;

      // V56.1 : priorité au planning IA déjà chargé en mémoire.
      try{
        const current=window.__myeventAiCurrentPlan;
        if(current?.plan?.event_id===event.id && Array.isArray(current.items) && current.items.length){
          plan=current.plan;
          items=current.items;
        }
      }catch(_){ }

      // V56.1 : secours local pour que la cagnotte fonctionne même avant
      // qu'une lecture Supabase soit disponible après actualisation.
      if(!items.length){
        try{
          const raw=localStorage.getItem('myevent_ai_plan_'+user.id+'_'+event.id);
          const localPlan=raw?JSON.parse(raw):null;
          if(localPlan?.event_id===event.id && Array.isArray(localPlan.items) && localPlan.items.length){
            plan={id:localPlan.plan_id||null,event_id:event.id,title:localPlan.title||'Planning IA',people:localPlan.people||1};
            items=localPlan.items;
          }
        }catch(_){ }
      }

      // Dernier secours : lecture de Supabase.
      if(!items.length){
        const aq=await sb.from('event_outing_plans').select('*').eq('event_id',event.id).order('created_at',{ascending:false}).limit(1);
        if(!aq.error&&Array.isArray(aq.data)&&aq.data[0]){
          plan=aq.data[0];
          const ar=await sb.from('event_outing_plan_items').select('*').eq('plan_id',plan.id).order('step_order',{ascending:true});
          if(!ar.error)items=ar.data||[];
        }
      }

      if(items.length){
        planTitle=plan?.title||'Planning IA';
        items.forEach(x=>{
          const n=Number(x.price_per_person);
          if(Number.isFinite(n)&&n>0){prices.push(n);knownCount++;}
          else missingCount++;
        });
      }
    }else{
      const outing=await getScopedEventOuting(event.id);
      const price=Number(outing?.price_per_person);
      if(Number.isFinite(price)&&price>0){prices=[price];knownCount=1;planTitle=outing?.title||outing?.name||'Sortie manuelle';}
      else if(outing)missingCount=1;
    }

    const estimatePerPerson=prices.reduce((a,b)=>a+b,0);
    const estimate=estimatePerPerson*members;
    $('fundSmartMembers').textContent=String(members);

    if(!(estimate>0)){
      $('fundSmartEstimate').textContent='—';
      $('fundSmartShare').textContent='—';
      if(msgBox && !silent)msgBox.textContent=choice==='ai'
        ? (missingCount>0
          ? 'Le planning IA est bien trouvé, mais aucun prix exploitable n’est renseigné pour ses '+missingCount+' étape'+(missingCount>1?'s':'')+'.'
          : 'Aucun planning IA sélectionné.')
        : 'Aucun prix exploitable n’est disponible dans le planning manuel.';
      return;
    }

    $('fundSmartEstimate').textContent=eur(estimate);
    $('fundSmartShare').textContent=eur(estimatePerPerson)+' / personne';

    const targetInput=$('fundTargetInput');
    if(targetInput && (!Number(targetInput.value)||Number(targetInput.value)<=0)){
      targetInput.value=estimate.toFixed(2);
    }

    if(msgBox && !silent){
      let estimatedCount=0;
      if(choice==='ai') items.forEach(x=>{if(x.source==='ai_estimate')estimatedCount++;});
      let text='Estimation basée sur '+knownCount+' prix connu'+(knownCount>1?'s':'')+' du planning '+(choice==='ai'?'IA':'manuel')+'.';
      if(estimatedCount>0)text+=' '+estimatedCount+' prix sont des estimations IA à confirmer.';
      if(planTitle)text+=' '+planTitle+'.';
      if(missingCount>0)text+=' '+missingCount+' étape'+(missingCount>1?'s':'')+' sans prix reste'+(missingCount>1?'nt':'')+' à confirmer.';
      msgBox.textContent=text;
    }
  }catch(e){
    if(msgBox && !silent)msgBox.textContent='Impossible de calculer le budget : '+(e.message||String(e));
  }finally{
    if(!silent && btn){btn.disabled=false;btn.textContent='✨ Calculer depuis le planning';}
  }
}

async function loadFund(){
  if(!event||!user||!sb)return;
  const sr=await sb.from('event_fund_settings').select('*').eq('event_id',event.id).maybeSingle();
  if(sr.error && !String(sr.error.message||'').includes('does not exist')){ $('fundEntries').innerHTML='<p class="err">'+esc(sr.error.message)+'</p>'; return; }
  const settings=sr.data||{target_amount:0,description:'',manager_user_id:null};
  const target=Number(settings.target_amount||0);
  $('fundTargetLabel').textContent='Objectif : '+eur(target);
  $('fundDescription').textContent=settings.description||'Organise les participations et les dépenses du groupe.';
  $('fundTargetInput').value=target||''; $('fundDescriptionInput').value=settings.description||'';
  const manager=fundIsManager(settings);
  $('editFundBtn').classList.toggle('hidden',!manager); if(!manager) fundSetFormOpen(false);
  const org=fundIsOrganizer();
  if(org){ await loadFundMembers(settings.manager_user_id); }
  const managerSelect=$('fundManagerSelect'); if(managerSelect) managerSelect.disabled=!org;
  await loadFundPayment(settings);

  const er=await sb.from('event_fund_entries').select('id,event_id,user_id,entry_type,amount,label,note,status,confirmed_by,confirmed_at,created_at').eq('event_id',event.id).order('created_at',{ascending:false});
  if(er.error){ $('fundEntries').innerHTML='<p class="err">'+esc(er.error.message)+'</p>'; return; }
  const entries=er.data||[];
  const contributions=entries.filter(x=>x.entry_type==='contribution');
  const confirmedContributions=contributions.filter(x=>(x.status||'pending')==='confirmed');
  const spent=entries.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+Number(x.amount||0),0);
  const collected=confirmedContributions.reduce((a,x)=>a+Number(x.amount||0),0);
  const balance=collected-spent;
  $('fundCollected').textContent=eur(collected); $('fundSpent').textContent=eur(spent); $('fundBalance').textContent=eur(balance);
  const pct=target>0?Math.min(100,(collected/target)*100):0; $('fundProgressBar').style.width=pct+'%';
  const memberCountResult=await sb.from('event_members').select('user_id',{count:'exact',head:true}).eq('event_id',event.id); const memberCount=Number(memberCountResult.count||0);
  $('fundPerPerson').textContent='· '+(memberCount?eur(target/memberCount):eur(target))+' / personne';
  renderMyStripePayment(entries,target,memberCount);
  const stripeSuccess=new URLSearchParams(location.search).get('stripe_success');
  const stripeCancel=new URLSearchParams(location.search).get('stripe_cancel');
  if(stripeSuccess){ $('fundMyPaymentMsg').textContent='✅ Paiement reçu. Stripe confirme la transaction ; la cagnotte se met à jour automatiquement.'; history.replaceState({},document.title,location.pathname+location.hash); }
  if(stripeCancel){ $('fundMyPaymentMsg').textContent='Paiement annulé. Aucun montant n’a été confirmé dans la cagnotte.'; history.replaceState({},document.title,location.pathname+location.hash); }

  const pending=contributions.filter(x=>(x.status||'pending')==='pending');
  const pendingBox=$('fundPendingBox'), pendingList=$('fundPendingEntries');
  if(pendingBox&&pendingList){
    pendingBox.classList.toggle('hidden',!(manager&&pending.length));
    pendingBox.style.display=(manager&&pending.length)?'block':'none';
    if(manager&&pending.length){
      const ids=[...new Set(pending.map(x=>x.user_id).filter(Boolean))]; let pp=[];
      if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids); if(!pr.error)pp=pr.data||[];}
      const pm=new Map(pp.map(p=>[p.id,p]));
      pendingList.innerHTML=pending.map(x=>{
        const p=pm.get(x.user_id)||{}; const name=x.user_id===user.id?'Moi':(p.display_name||p.username||'Membre');
        const note=x.note?'<span>'+esc(x.note)+'</span>':'';
        return '<div class="fundEntry"><div class="fundEntryMain"><b>'+esc(name)+' <span class="fundStatus fundPending">🟠 En attente</span></b><span>'+new Date(x.created_at).toLocaleDateString('fr-FR')+' · '+eur(x.amount)+'</span>'+note+'</div><div class="fundVerifyActions"><button type="button" data-fund-confirm="'+esc(x.id)+'">✅ Confirmer</button><button type="button" class="secondary" data-fund-reject="'+esc(x.id)+'">❌ Refuser</button></div></div>';
      }).join('');
    }else pendingList.innerHTML='';
  }

  // Suivi individuel des participants : le responsable voit tout le groupe,
  // chaque autre membre voit uniquement son propre statut.
  const trackingBox=$('fundMemberTrackingBox'), myBox=$('fundMyTrackingBox');
  // V50.5 : le suivi est explicitement affiché pour le responsable / organisateur.
  if(trackingBox){ trackingBox.classList.toggle('hidden',!manager); trackingBox.style.display=manager?'block':'none'; }
  if(myBox) myBox.classList.toggle('hidden',manager);
  const membersRes=await sb.from('event_members').select('user_id,nickname,joined_at').eq('event_id',event.id).order('joined_at',{ascending:true});
  const eventMembers=membersRes.data||[];
  const memberIds=[...new Set(eventMembers.map(m=>m.user_id).filter(Boolean))];
  let memberProfiles=[];
  if(memberIds.length){ const pr=await sb.from('profiles').select('id,display_name,username').in('id',memberIds); if(!pr.error) memberProfiles=pr.data||[]; }
  const memberMap=new Map(memberProfiles.map(p=>[p.id,p]));
  // V54.42 : si l'objectif manuel vaut 0, utiliser le budget intelligent
  // calculé depuis le planning, comme pour le montant recommandé du paiement.
  // Ainsi un paiement intégral de la part recommandée est bien affiché
  // « Confirmé » et non « Partiellement confirmé ».
  let trackingBudget=Number(target||0);
  if(!(trackingBudget>0)){
    const smartText=String($('fundSmartEstimate')?.textContent||'');
    const smartMatch=smartText.replace(/\s/g,'').replace('€','').match(/[0-9]+(?:[.,][0-9]+)?/);
    const smartEstimate=smartMatch?Number(String(smartMatch[0]).replace(',','.')):0;
    if(Number.isFinite(smartEstimate)&&smartEstimate>0) trackingBudget=smartEstimate;
  }
  const expectedPerPerson=memberCount?Math.round((trackingBudget/memberCount)*100)/100:0;
  const byUser=new Map();
  contributions.forEach(x=>{
    if(!x.user_id)return;
    const cur=byUser.get(x.user_id)||{confirmed:0,pending:0,rejected:0};
    const st=x.status||'pending';
    if(st==='confirmed')cur.confirmed+=Number(x.amount||0);
    else if(st==='pending')cur.pending+=Number(x.amount||0);
    else cur.rejected+=Number(x.amount||0);
    byUser.set(x.user_id,cur);
  });
  const trackingHtml=(m)=>{
    const p=memberMap.get(m.user_id)||{};
    const name=m.user_id===user.id?'Moi':(m.nickname||p.display_name||p.username||'Membre');
    const d=byUser.get(m.user_id)||{confirmed:0,pending:0,rejected:0};
    const remaining=Math.max(0,expectedPerPerson-d.confirmed-d.pending);
    let statusHtml='<span class="fundStatus fundRejected">🔴 Non payé</span>';
    if(d.confirmed>0 && d.pending>0) statusHtml='<span class="fundStatus fundPending">🟠 Partiel / en attente</span>';
    else if(d.pending>0) statusHtml='<span class="fundStatus fundPending">🟠 En attente</span>';
    else if(d.confirmed>=expectedPerPerson && expectedPerPerson>0) statusHtml='<span class="fundStatus fundConfirmed">🟢 Confirmé</span>';
    else if(d.confirmed>0) statusHtml='<span class="fundStatus fundConfirmed">🟢 Partiellement confirmé</span>';
    const paid=d.confirmed;
    const pendingTxt=d.pending>0?' · '+eur(d.pending)+' en attente':'';
    const remainTxt=expectedPerPerson>0?'Reste '+eur(remaining):'Objectif individuel non défini';
    return '<div class="fundMemberRow"><div class="fundMemberName"><b>'+esc(name)+'</b><span>'+eur(paid)+' confirmé'+pendingTxt+'</span></div><div class="fundMemberStatus">'+statusHtml+'</div><div class="fundMemberRemain">'+esc(remainTxt)+'</div></div>';
  };
  if(manager && trackingBox){
    const list=$('fundMemberTracking');
    const summary=$('fundMemberTrackingSummary');
    if(list) list.innerHTML=eventMembers.length?eventMembers.map(trackingHtml).join(''):'<p class="muted">Aucun participant.</p>';
    if(summary){
      const totalMembers=eventMembers.length;
      const confirmedCount=eventMembers.filter(m=>{const d=byUser.get(m.user_id)||{confirmed:0,pending:0}; return expectedPerPerson>0 && d.confirmed>=expectedPerPerson;}).length;
      const pendingCount=eventMembers.filter(m=>{const d=byUser.get(m.user_id)||{confirmed:0,pending:0}; return d.pending>0 && d.confirmed<expectedPerPerson;}).length;
      const unpaidCount=Math.max(0,totalMembers-confirmedCount-pendingCount);
      const pendingAmount=contributions.filter(x=>(x.status||'pending')==='pending').reduce((a,x)=>a+Number(x.amount||0),0);
      const remainingTotal=Math.max(0,(expectedPerPerson*totalMembers)-collected-pendingAmount);
      summary.innerHTML='<b>'+totalMembers+' participant'+(totalMembers>1?'s':'')+'</b> · '+
        '<span class="fundConfirmed">🟢 '+confirmedCount+' confirmé'+(confirmedCount>1?'s':'')+'</span> · '+
        '<span class="fundPending">🟠 '+pendingCount+' en attente</span> · '+
        '<span class="fundRejected">🔴 '+unpaidCount+' non payé'+(unpaidCount>1?'s':'')+'</span><br>'+
        '<b>'+eur(collected)+'</b> confirmés · <b>'+eur(pendingAmount)+'</b> en attente · <b>'+eur(remainingTotal)+'</b> restant à collecter';
    }
    if(trackingBox) trackingBox.style.display='block';
  }
  if(!manager && myBox){
    const mine=eventMembers.find(m=>m.user_id===user.id)||{user_id:user.id};
    const p=memberMap.get(user.id)||{};
    const d=byUser.get(user.id)||{confirmed:0,pending:0,rejected:0};
    const remaining=Math.max(0,expectedPerPerson-d.confirmed-d.pending);
    let state=d.confirmed>0?'🟢 '+eur(d.confirmed)+' confirmé':d.pending>0?'🟠 '+eur(d.pending)+' en attente':'🔴 Aucune participation déclarée';
    $('fundMyTracking').innerHTML='<b>'+esc(state)+'</b>'+(expectedPerPerson>0?' · Reste '+eur(remaining):'');
  }

  // V56.1 : la cagnotte se recalcule automatiquement depuis le planning sélectionné.
  // Le bouton reste disponible pour forcer un recalcul manuel.
  await calculateSmartFund({silent:true});

  if(!entries.length){ $('fundEntries').innerHTML='<p class="muted">Aucune participation ou dépense pour le moment.</p>'; return; }
  const ids=[...new Set(entries.map(x=>x.user_id).filter(Boolean))]; let profiles=[]; if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids); if(!pr.error)profiles=pr.data||[];}
  const pmap=new Map(profiles.map(p=>[p.id,p]));
  $('fundEntries').innerHTML=entries.map(x=>{
    const p=pmap.get(x.user_id)||{}; const name=x.user_id===user.id?'Moi':(p.display_name||p.username||'Membre');
    const isC=x.entry_type==='contribution'; const title=x.label||(isC?'Participation':'Dépense');
    const status=isC?(x.status||'pending'):'confirmed';
    const statusHtml=isC ? (status==='confirmed'?'<span class="fundStatus fundConfirmed">🟢 Confirmé</span>':status==='rejected'?'<span class="fundStatus fundRejected">🔴 Refusé</span>':'<span class="fundStatus fundPending">🟠 En attente</span>') : '';
    const sign=isC?'+':'−'; const cls=isC?(status==='confirmed'?'fundConfirmed':status==='rejected'?'fundRejected':'fundPending'):'fundExpense';
    const note=x.note?'<span>'+esc(x.note)+'</span>':'';
    return '<div class="fundEntry"><div class="fundEntryMain"><b>'+esc(title)+statusHtml+'</b><span>'+esc(name)+' · '+new Date(x.created_at).toLocaleDateString('fr-FR')+'</span>'+note+'</div><b class="fundEntryAmount '+cls+'">'+sign+' '+eur(x.amount)+'</b></div>';
  }).join('');
}

async function updateContributionStatus(id,status){
  if(!event||!user)return;
  const settingsRes=await sb.from('event_fund_settings').select('manager_user_id').eq('event_id',event.id).maybeSingle();
  const settings=settingsRes.data||{};
  if(!fundIsManager(settings)){alert('Seul le responsable de la cagnotte peut valider un paiement.');return;}
  const payload={status,confirmed_by:status==='confirmed'?user.id:null,confirmed_at:status==='confirmed'?new Date().toISOString():null};
  const r=await sb.from('event_fund_entries').update(payload).eq('id',id).eq('event_id',event.id).eq('entry_type','contribution');
  if(r.error){alert('Erreur : '+r.error.message);return;}
  await loadFund();
}

async function saveFundSettings(){
  if(!event||!user)return;
  const sr=await sb.from('event_fund_settings').select('manager_user_id').eq('event_id',event.id).maybeSingle();
  const currentManagerId=sr.data?.manager_user_id||null;
  const manager=fundIsManager({manager_user_id:currentManagerId});
  if(!manager)return;
  const target=Math.max(0,Number($('fundTargetInput').value||0)); const description=String($('fundDescriptionInput').value||'').trim(); const managerId=fundIsOrganizer()?($('fundManagerSelect').value||null):currentManagerId;
  $('saveFundSettingsBtn').disabled=true; msg('fundSettingsMsg','Enregistrement…');
  const r=await sb.from('event_fund_settings').upsert({event_id:event.id,target_amount:target,description,manager_user_id:managerId,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'event_id'});
  $('saveFundSettingsBtn').disabled=false;
  if(r.error){msg('fundSettingsMsg','Erreur : '+r.error.message,'err');return;}
  msg('fundSettingsMsg','Budget et responsable enregistrés.','ok'); await loadFund();
}
async function saveFundPayment(){
  if(!event||!user)return;
  const holder=String($('fundAccountHolder').value||'').trim(); const iban=normalizeIban($('fundIban').value); const bic=String($('fundBic').value||'').trim().toUpperCase(); const note=String($('fundPaymentNote').value||'').trim();
  if(!holder||!iban){msg('fundPaymentMsg','Indique le titulaire et un IBAN.','err');return;}
  if(!/^FR\d{25}$/.test(iban) && !/^[A-Z]{2}\d{13,32}$/.test(iban)){msg('fundPaymentMsg','IBAN invalide ou incomplet.','err');return;}
  if(bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic)){msg('fundPaymentMsg','BIC invalide.','err');return;}
  $('saveFundPaymentBtn').disabled=true; msg('fundPaymentMsg','Enregistrement sécurisé…');
  const r=await sb.from('event_fund_payment_details').upsert({event_id:event.id,account_holder:holder,iban,bic:bic||null,payment_note:note||null,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'event_id'});
  $('saveFundPaymentBtn').disabled=false;
  if(r.error){msg('fundPaymentMsg','Erreur : '+r.error.message,'err');return;}
  fundPaymentFormOpen(false); await loadFund();
}
async function saveContribution(){
  if(!event||!user)return; const amount=Number($('fundContributionAmount').value||0); if(!(amount>0)){msg('fundContributionMsg','Indique un montant supérieur à 0.','err');return;}
  $('saveContributionBtn').disabled=true; const r=await sb.from('event_fund_entries').insert({event_id:event.id,user_id:user.id,entry_type:'contribution',amount,label:'Participation',note:String($('fundContributionNote').value||'').trim()||null,status:'pending'}); $('saveContributionBtn').disabled=false;
  if(r.error){msg('fundContributionMsg','Erreur : '+r.error.message,'err');return;} fundContributionFormOpen(false); await loadFund();
}
async function saveExpense(){
  if(!event||!user)return; const amount=Number($('fundExpenseAmount').value||0); const label=String($('fundExpenseLabel').value||'').trim(); if(!(amount>0)||!label){msg('fundExpenseMsg','Indique un montant et un libellé.','err');return;}
  $('saveExpenseBtn').disabled=true; const r=await sb.from('event_fund_entries').insert({event_id:event.id,user_id:user.id,entry_type:'expense',amount,label}); $('saveExpenseBtn').disabled=false;
  if(r.error){msg('fundExpenseMsg','Erreur : '+r.error.message,'err');return;} fundExpenseFormOpen(false); await loadFund();
}
async function loadMembers(){
  if(!event)return;
  const r=await sb.from('event_members').select('user_id,nickname,role,status,joined_at').eq('event_id',event.id).order('joined_at',{ascending:true});
  if(r.error){ $('members').innerHTML='<p class="err">'+esc(r.error.message)+'</p>'; return; }
  const members=r.data||[];
  $('memberCount').textContent='· '+members.length+' participant'+(members.length>1?'s':'');
  $('statMembers').textContent=members.length;
  if(!members.length){ $('members').innerHTML='<p class="muted">Aucun participant pour le moment.</p>'; return; }

  const ids=members.map(m=>m.user_id).filter(Boolean);
  let profiles=[];
  if(ids.length){
    const pr=await sb.from('profiles').select('id,display_name,username,avatar').in('id',ids);
    if(!pr.error) profiles=pr.data||[];
  }
  const pmap=new Map(profiles.map(p=>[p.id,p]));

  $('members').innerHTML=members.map(m=>{
    const p=pmap.get(m.user_id)||{};
    const name=m.nickname||p.display_name||p.username||'Membre';
    const avatar=p.avatar||'';
    const initial=esc(name.charAt(0).toUpperCase());
    const badge=m.role==='owner'?'Organisateur':'Participant';
    return '<div class="memberRow">'+
      avatarHtml(avatar,'avatar')+
      '<div class="memberInfo"><b>'+esc(name)+'</b><span>'+badge+(m.status&&m.status!=='active'?' · '+esc(m.status):'')+'</span></div>'+
      (m.user_id===user.id?'<span class="youBadge">Moi</span>':'')+
      '</div>';
  }).join('');
}

async function loadUnreadCount(){
  if(!event||!user)return;
  const r=await sb.from('message_reads').select('last_read_at').eq('event_id',event.id).eq('user_id',user.id).maybeSingle();
  if(r.error){
    console.warn('Lecture des messages non lus:',r.error.message);
    return;
  }
  const lastRead=r.data?.last_read_at||null;
  let q=sb.from('messages').select('id',{count:'exact',head:true}).eq('event_id',event.id).neq('user_id',user.id);
  if(lastRead) q=q.gt('created_at',lastRead);
  const c=await q;
  if(c.error){console.warn('Comptage des messages non lus:',c.error.message);return;}
  const count=c.count||0;
  const badge=$('discussionBadge');
  if(!badge)return;
  badge.textContent=count>99?'99+':String(count);
  badge.classList.toggle('hidden',count===0);
}

async function markDiscussionRead(){
  if(!event||!user)return;
  const r=await sb.from('message_reads').upsert({event_id:event.id,user_id:user.id,last_read_at:new Date().toISOString()},{onConflict:'event_id,user_id'});
  if(r.error){console.warn('Marquage comme lu:',r.error.message);return;}
  const badge=$('discussionBadge');
  if(badge){badge.textContent='0';badge.classList.add('hidden');}
}

function getDeviceId(){
  let id=localStorage.getItem('myevent_device_id');
  if(!id){
    id=(crypto?.randomUUID?.()||('d_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)));
    localStorage.setItem('myevent_device_id',id);
  }
  return id;
}

function unreadStorageKey(type){
  return user&&event ? 'myevent_v4_'+type+'_read_'+getDeviceId()+'_'+event.id : '';
}

function setUnreadBadge(id,count){
  const badge=$(id);
  if(!badge)return;
  badge.textContent=count>99?'99+':String(count);
  badge.classList.toggle('hidden',count===0);
}

function localCreatedKey(type){
  return event&&user ? 'myevent_local_'+type+'_'+user.id+'_'+event.id : '';
}

function localCreatedSet(type){
  try{return new Set(JSON.parse(localStorage.getItem(localCreatedKey(type))||'[]'));}catch{return new Set();}
}

function rememberLocalCreated(type,id){
  if(!id)return;
  const key=localCreatedKey(type); if(!key)return;
  const set=localCreatedSet(type); set.add(String(id));
  const arr=[...set].slice(-300);
  localStorage.setItem(key,JSON.stringify(arr));
}

function isLocallyCreated(type,id){
  return localCreatedSet(type).has(String(id));
}

async function initializeUnreadMarkers(){
  if(!event||!user)return;
  // Chaque appareil possède son propre point de départ.
  // Les nouveautés créées après cette ouverture seront donc détectées
  // même si un autre téléphone utilise le même compte MyEvent.
  const now=new Date().toISOString();
  for(const type of ['polls','media','members','votes']){
    const key=unreadStorageKey(type);
    if(!localStorage.getItem(key)) localStorage.setItem(key,now);
  }
}

async function loadUnreadPollCount(){
  if(!event||!user)return;
  const key=unreadStorageKey('polls');
  const saved=localStorage.getItem(key);
  let pollCount=0;
  if(saved){
    const r=await sb.from('polls').select('id,created_at').eq('event_id',event.id).gt('created_at',saved);
    if(r.error){console.warn('Comptage des sondages non lus:',r.error.message);return;}
    pollCount=(r.data||[]).filter(x=>!isLocallyCreated('polls',x.id)).length;
  }

  let voteCount=0;
  const voteSaved=localStorage.getItem(unreadStorageKey('votes'));
  if(voteSaved){
    const pr=await sb.from('polls').select('id').eq('event_id',event.id).eq('creator_id',user.id);
    if(!pr.error && pr.data?.length){
      const ids=pr.data.map(x=>x.id);
      const vr=await sb.from('poll_votes').select('poll_id,user_id,created_at').in('poll_id',ids).neq('user_id',user.id).gt('created_at',voteSaved);
      if(!vr.error) voteCount=(vr.data||[]).length;
    }
  }
  setUnreadBadge('pollBadge',pollCount+voteCount);
}

async function markPollsRead(){
  if(!event||!user)return;
  const now=new Date().toISOString();
  localStorage.setItem(unreadStorageKey('polls'),now);
  localStorage.setItem(unreadStorageKey('votes'),now);
  setUnreadBadge('pollBadge',0);
}

async function loadUnreadMediaCount(){
  if(!event||!user)return;
  const key=unreadStorageKey('media');
  const saved=localStorage.getItem(key);
  if(!saved){setUnreadBadge('mediaBadge',0);return;}
  const r=await sb.from('media').select('id,created_at').eq('event_id',event.id).gt('created_at',saved);
  if(r.error){console.warn('Comptage des photos non lues:',r.error.message);return;}
  const rows=(r.data||[]).filter(x=>!isLocallyCreated('media',x.id));
  setUnreadBadge('mediaBadge',rows.length);
}

async function markMediaRead(){
  if(!event||!user)return;
  localStorage.setItem(unreadStorageKey('media'),new Date().toISOString());
  setUnreadBadge('mediaBadge',0);
}

async function markMembersRead(){
  if(!event||!user)return;
  localStorage.setItem(unreadStorageKey('members'),new Date().toISOString());
}

let discussionScrollTargetId=null;

async function loadMessages(){
  if(!event)return;
  // On reconnect/open, remember the first incoming message after the last read point.
  // If there is none, the discussion opens on the latest message.
  let lastReadAt=null;
  try{
    const read=await sb.from('message_reads').select('last_read_at').eq('event_id',event.id).eq('user_id',user.id).maybeSingle();
    lastReadAt=read.data?.last_read_at||null;
  }catch{}
  const r=await sb.from('messages').select('*').eq('event_id',event.id).order('created_at',{ascending:true});
  if(r.error){$('messages').innerHTML='<p class="err">'+esc(r.error.message)+'</p>';return}
  const rows=r.data||[];
  const rr=rows.length?await sb.from('message_reactions').select('message_id,user_id,reaction').in('message_id',rows.map(m=>m.id)):({data:[],error:null});
  const reactions=rr.error?[]:(rr.data||[]);
  const reactionMap=new Map();
  reactions.forEach(x=>{if(!reactionMap.has(x.message_id))reactionMap.set(x.message_id,[]);reactionMap.get(x.message_id).push(x)});
  // Les sondages créés depuis la discussion sont aussi des messages de discussion.
  const pollMessageMap=new Map();
  const pollMessageIds=[];
  rows.forEach(m=>{
    if(typeof m.content==='string' && m.content.startsWith('[[MYEVENT_POLL]]')){
      try{ const payload=JSON.parse(m.content.slice('[[MYEVENT_POLL]]'.length)); if(payload?.poll_id) pollMessageIds.push(payload.poll_id); }catch{}
    }
  });
  if(pollMessageIds.length){
    const uniq=[...new Set(pollMessageIds)];
    const pr=await sb.from('polls').select('id,question,allow_multiple,creator_id,created_at').in('id',uniq).eq('event_id',event.id);
    const ors=await sb.from('poll_options').select('id,poll_id,option_text').in('poll_id',uniq);
    const vrs=await sb.from('poll_votes').select('poll_id,option_id,user_id').in('poll_id',uniq);
    const options=ors.error?[]:(ors.data||[]), votes=vrs.error?[]:(vrs.data||[]);
    (pr.error?[]:(pr.data||[])).forEach(p=>pollMessageMap.set(p.id,{...p,options:options.filter(o=>o.poll_id===p.id),votes:votes.filter(v=>v.poll_id===p.id)}));
  }
  const vr=await sb.from('voice_messages').select('id,user_id,storage_path,duration_ms,created_at').eq('event_id',event.id).order('created_at',{ascending:true});
  if(vr.error){
    console.error('voice_messages SELECT:',vr.error);
  }
  const voices=vr.error?[]:(vr.data||[]);
  const ids=[...new Set([...rows.map(m=>m.user_id),...voices.map(m=>m.user_id)].filter(Boolean))];
  let profiles=[];
  if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username,avatar').in('id',ids);if(!pr.error)profiles=pr.data||[];}
  const pmap=new Map(profiles.map(p=>[p.id,p]));
  const voiceUrls=await Promise.all(voices.map(async m=>{
    const local=voiceLocalUrls.get(String(m.id))||'';
    const x=await sb.storage.from('event-voices').createSignedUrl(m.storage_path,3600);
    return {...m,url:x.data?.signedUrl||local||'',storageError:x.error?.message||''};
  }));
  const all=[
    ...rows.map(m=>({kind:'message',created_at:m.created_at,data:m})),
    ...voiceUrls.map(m=>({kind:'voice',created_at:m.created_at,data:m}))
  ].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const unreadItem=lastReadAt ? all.find(item=>new Date(item.created_at)>new Date(lastReadAt) && item.data?.user_id!==user.id) : null;
  const hasUnreadTarget=!!unreadItem;
  discussionScrollTargetId=unreadItem?.data?.id||all[all.length-1]?.data?.id||null;
  // Un seul bandeau d'appel doit être visible : on conserve uniquement
  // l'annonce la plus récente du salon, même si plusieurs essais ont créé
  // plusieurs messages techniques dans la base.
  const callAlertIds=new Set(all.filter(item=>item.kind==='message' && typeof item.data.content==='string' && item.data.content.startsWith('[[MYEVENT_GROUP_CALL]]')).map(item=>item.data.id));
  const latestCallAlert=[...all].reverse().find(item=>callAlertIds.has(item.data?.id));
  const latestCallAlertId=latestCallAlert?.data?.id||null;
  $('messages').innerHTML=(await Promise.all(all.map(async item=>{
    const m=item.data;
    const p=pmap.get(m.user_id)||{};
    const mine=m.user_id===user.id;
    const name=mine?'Moi':(p.display_name||p.username||'Membre');
    const av=p.avatar||'';
    if(item.kind==='message' && typeof m.content==='string' && m.content.startsWith('[[MYEVENT_GROUP_CALL]]')){
      if(m.id!==latestCallAlertId)return '';
      let callLabel='Appel de groupe';
      try{ const payload=JSON.parse(m.content.slice('[[MYEVENT_GROUP_CALL]]'.length)); callLabel=payload?.eventName||callLabel; }catch{}
      return '<div class="callAlertMessage" data-call-alert="'+esc(m.id)+'">'+
        '<b>📞 Appel de groupe lancé</b>'+
        '<p>'+esc(callLabel)+'</p>'+
        '<button type="button" class="secondary joinCallMessage">↗️ Rejoindre l’appel</button>'+
      '</div>';
    }
    if(item.kind==='message' && typeof m.content==='string' && m.content.startsWith('[[MYEVENT_POLL]]')){
      let payload=null; try{payload=JSON.parse(m.content.slice('[[MYEVENT_POLL]]'.length));}catch{}
      const poll=payload?.poll_id?pollMessageMap.get(payload.poll_id):null;
      if(!poll)return '';
      const pv=poll.votes||[];
      const optionsHtml=(poll.options||[]).map(o=>{
        const count=pv.filter(v=>v.option_id===o.id).length;
        const selected=pv.some(v=>v.option_id===o.id&&v.user_id===user.id);
        const pct=pv.length?Math.round(count/pv.length*100):0;
        return '<div class="chatPollOption"><button type="button" class="secondary chatPollVote '+(selected?'selectedVote':'')+'" data-poll="'+esc(poll.id)+'" data-option="'+esc(o.id)+'">'+esc(o.option_text)+' <span>'+count+'</span></button><div class="chatPollBar"><i style="width:'+pct+'%"></i></div></div>';
      }).join('');
      const multiple=poll.allow_multiple?' · Plusieurs réponses':' · 1 réponse';
      return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'">'+avatarHtml(av,'messageAvatar')+'<div class="messageBody chatPollMessage"><div class="messageMeta"><span>'+esc(name)+'</span><span>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</span></div><div class="chatPollTitle">📊 '+esc(poll.question)+'</div><div class="chatPollHint">Sondage'+multiple+'</div>'+optionsHtml+'</div></div>';
    }
    if(item.kind==='message' && typeof m.content==='string' && m.content.startsWith('[[MYEVENT_AI_DECISION]]')){
      let payload=null; try{payload=JSON.parse(m.content.slice('[[MYEVENT_AI_DECISION]]'.length));}catch{}
      if(!payload)return '';
      return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'">'+avatarHtml(av,'messageAvatar')+'<div class="messageBody chatPollMessage"><div class="messageMeta"><span>'+esc(name)+'</span><span>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</span></div><div class="chatPollTitle">🤖 Décision IA validée</div><div class="chatPollHint">'+esc(payload.question||'Sondage')+'</div><p><b>Choix validé :</b> '+esc(payload.choice||'')+'</p>'+(payload.action?'<p><b>Action proposée :</b> '+esc(payload.action)+'</p>':'')+'<div class="pollDecisionValidated">✓ Validée par l’organisateur</div></div></div>';
    }
    if(item.kind==='message' && typeof m.content==='string' && m.content.startsWith('[[MYEVENT_AI_ACTION]]')){
      let payload=null; try{payload=JSON.parse(m.content.slice('[[MYEVENT_AI_ACTION]]'.length));}catch{}
      if(!payload)return '';
      const displayAction=pollActionDisplay(payload.action,payload.choice);
      return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'">'+avatarHtml(av,'messageAvatar')+'<div class="messageBody chatPollMessage"><div class="messageMeta"><span>'+esc(name)+'</span><span>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</span></div><div class="chatPollTitle">⚡ Action créée</div><div class="chatPollHint">Décision issue du sondage : '+esc(payload.question||'Sondage')+'</div><p><b>Choix :</b> '+esc(payload.choice||'')+'</p>'+(displayAction?'<p><b>Action :</b> '+esc(displayAction)+'</p>':'')+'<div class="pollDecisionValidated">⚡ Action publiée dans l’événement</div></div></div>';
    }
    if(item.kind==='message' && typeof m.content==='string' && m.content.startsWith('[[MYEVENT_ATTACHMENT]]')){ 
      let a=null; try{a=JSON.parse(m.content.slice('[[MYEVENT_ATTACHMENT]]'.length));}catch{}
      if(!a?.path)return '';
      const sx=await sb.storage.from('event-media').createSignedUrl(a.path,3600);
      const url=sx.data?.signedUrl||''; if(!url)return '';
      const isImage=(a.type||'').startsWith('image/'), isVideo=(a.type||'').startsWith('video/');
      const preview=isImage?'<img class="chatAttachmentImage" src="'+esc(url)+'" alt="'+esc(a.name||'Image')+'">':isVideo?'<video class="chatAttachmentVideo" src="'+esc(url)+'" controls preload="metadata"></video>':'<a class="chatAttachmentFile" href="'+esc(url)+'" target="_blank" rel="noopener">📎 '+esc(a.name||'Fichier joint')+'</a>';
      return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'">'+avatarHtml(av,'messageAvatar')+'<div class="messageBody chatAttachmentMessage"><div class="messageMeta"><span>'+esc(name)+'</span><span>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</span></div>'+preview+'</div></div>';
    }
    if(item.kind==='voice'){
      const duration=m.duration_ms?formatVoiceDuration(m.duration_ms):'0:00';
      if(!m.url){
        return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'"><div class="messageBody voiceMessage"><div class="voiceLabel">🎙️ Vocal</div><div class="muted">Vocal enregistré, mais lecture indisponible. Vérifie la politique SELECT du bucket « event-voices ».</div></div></div>';
      }
      return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'">'+
        avatarHtml(av,'messageAvatar')+
        '<div class="messageBody voiceMessage"><div class="voiceWhatsAppRow">'+
        '<button type="button" class="voicePlayBtn" data-voice-url="'+esc(m.url)+'" aria-label="Lire le vocal">▶</button>'+
        '<div class="voiceWaveform" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
        '<span class="voiceDuration">'+duration+'</span><button type="button" class="voiceSpeed" data-speed="1" aria-label="Changer la vitesse de lecture">1×</button></div>'+
        '<audio class="voiceAudio" src="'+esc(m.url)+'" preload="metadata"></audio>'+
        '<div class="voiceMetaLine"><span>'+esc(name)+'</span><span>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</span>'+(mine?'<button type="button" class="deleteVoice" data-id="'+m.id+'" data-path="'+esc(m.storage_path)+'" aria-label="Supprimer">×</button>':'')+'</div>'+
        '</div></div>';
    }
    const rs=reactionMap.get(m.id)||[];
    const quickEmojis=['👍','❤️','😂','😮','😢','🔥'];
    const allEmojis=['👍','❤️','😂','😮','😢','🔥','😍','🥰','😘','🤩','👏','🙏','🎉','🥳','🤣','😎','🤔','😡','😱','😭','💪','🙌','💯','✨'];
    const used=allEmojis.filter(e=>rs.some(x=>x.reaction===e));
    const selectedReaction=rs.find(x=>x.user_id===user.id)?.reaction||'';
    const summary=used.map(e=>{
      const count=rs.filter(x=>x.reaction===e).length;
      const selected=e===selectedReaction;
      return '<button type="button" class="reactionSummary '+(selected?'selected':'')+'" data-message-id="'+m.id+'" data-reaction="'+e+'">'+e+' '+count+'</button>';
    }).join('');
    const quick=quickEmojis.map(e=>'<button type="button" class="reactionBtn" data-message-id="'+m.id+'" data-reaction="'+e+'">'+e+'</button>').join('');
    const full=allEmojis.map(e=>'<button type="button" class="reactionBtn" data-message-id="'+m.id+'" data-reaction="'+e+'">'+e+'</button>').join('');
    const reactionHtml='<div class="messageReactions">'+summary+
      '<div class="reactionPicker hidden" data-picker="'+m.id+'">'+
        '<div class="reactionQuick">'+quick+'<button type="button" class="reactionMore" data-more="'+m.id+'" aria-label="Plus de réactions">•••</button></div>'+
        '<div class="reactionFull hidden" data-full="'+m.id+'">'+full+'</div>'+ 
      '</div></div>';
    return '<div class="messageRow '+(mine?'me':'')+'" data-message-id="'+esc(m.id)+'">'+
      avatarHtml(av,'messageAvatar')+
      '<div class="messageBody"><div class="messageMeta"><span>'+esc(name)+'</span><span>'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</span></div><div class="messageText">'+esc(m.content)+'</div>'+reactionHtml+'</div></div>';
  }))).join('');
  document.querySelectorAll('.deleteVoice').forEach(b=>b.addEventListener('click',()=>deleteVoice(b.dataset.id,b.dataset.path)));
  document.querySelectorAll('.chatPollVote').forEach(b=>{
    b.addEventListener('click',()=>vote(b.dataset.poll,b.dataset.option,b));
  });
  document.querySelectorAll('.reactionSummary').forEach(b=>b.addEventListener('click',()=>toggleMessageReaction(b.dataset.messageId,b.dataset.reaction)));
  document.querySelectorAll('.reactionBtn').forEach(b=>b.addEventListener('click',()=>{
    const messageId=b.dataset.messageId;
    closeReactionPickers();
    toggleMessageReaction(messageId,b.dataset.reaction);
  }));
  document.querySelectorAll('.reactionMore').forEach(b=>b.addEventListener('click',()=>{
    const full=document.querySelector('[data-full="'+b.dataset.more+'"]');
    if(full)full.classList.toggle('hidden');
  }));
  document.querySelectorAll('.joinCallMessage').forEach(b=>b.addEventListener('click',()=>startGroupCall()));
  bindLongPressReactions();

  // WhatsApp-like compact voice controls.
  document.querySelectorAll('#messages .voicePlayBtn').forEach(btn=>{
    const audio=btn.closest('.voiceMessage')?.querySelector('.voiceAudio');
    if(!audio)return;
    btn.addEventListener('click',async()=>{
      document.querySelectorAll('#messages .voiceAudio').forEach(a=>{if(a!==audio){a.pause();a.currentTime=0;}});
      try{
        if(audio.paused){await audio.play();btn.textContent='❚❚';btn.classList.add('playing');}
        else{audio.pause();btn.textContent='▶';btn.classList.remove('playing');}
      }catch{}
    });
    audio.addEventListener('play',()=>{btn.textContent='❚❚';btn.classList.add('playing')});
    audio.addEventListener('pause',()=>{btn.textContent='▶';btn.classList.remove('playing')});
    audio.addEventListener('ended',()=>{btn.textContent='▶';btn.classList.remove('playing');audio.currentTime=0});
  });
  // Rétablit les vitesses 1× / 1,5× / 2× sur tous les vocaux reçus.
  bindVoiceSpeeds(document.getElementById('messages')||document);
  if($('statMessages'))$('statMessages').textContent=rows.length;
  await loadUnreadCount();
  const restoreDiscussionPosition=()=>{
    const messagesBox=document.getElementById('messages');
    if(!messagesBox)return;
    const target=discussionScrollTargetId ? document.querySelector('#messages [data-message-id="'+CSS.escape(String(discussionScrollTargetId))+'"]') : null;
    if(target && hasUnreadTarget){
      target.scrollIntoView({behavior:'auto',block:'center'});
    }else{
      messagesBox.scrollTop=messagesBox.scrollHeight;
    }
  };
  // Les images/vocaux peuvent modifier la hauteur après le premier rendu.
  // On recale donc plusieurs fois, sans animation, comme WhatsApp/Snapchat.
  requestAnimationFrame(restoreDiscussionPosition);
  setTimeout(restoreDiscussionPosition,120);
  setTimeout(restoreDiscussionPosition,450);
  setTimeout(restoreDiscussionPosition,1000);
  document.querySelectorAll('#messages img,#messages video').forEach(el=>{
    if(!el.complete) el.addEventListener('loadeddata',restoreDiscussionPosition,{once:true});
    el.addEventListener('load',restoreDiscussionPosition,{once:true});
  });
}

function closeReactionPickers(){
  document.querySelectorAll('.reactionPicker').forEach(x=>x.classList.add('hidden'));
  document.querySelectorAll('.reactionFull').forEach(x=>x.classList.add('hidden'));
}

function bindLongPressReactions(){
  let timer=null;
  const clear=()=>{if(timer){clearTimeout(timer);timer=null;}};
  document.querySelectorAll('#messages .messageBody').forEach(body=>{
    const messageId=body.closest('.messageRow')?.querySelector('[data-message-id]')?.dataset.messageId;
    if(!messageId)return;
    const start=()=>{
      clear();
      timer=setTimeout(()=>{
        const picker=document.querySelector('[data-picker="'+messageId+'"]');
        if(picker){closeReactionPickers();picker.classList.remove('hidden');}
        timer=null;
      },500);
    };
    body.addEventListener('touchstart',start,{passive:true});
    body.addEventListener('touchend',clear,{passive:true});
    body.addEventListener('touchcancel',clear,{passive:true});
    body.addEventListener('touchmove',clear,{passive:true});
    body.addEventListener('contextmenu',e=>{e.preventDefault();start();});
  });
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.messageReactions'))closeReactionPickers();
});

async function toggleMessageReaction(messageId,reaction){
  if(!user||!event)return;
  const existing=await sb.from('message_reactions').select('reaction').eq('message_id',messageId).eq('user_id',user.id).maybeSingle();
  if(existing.error){alert(existing.error.message);return}
  let r;
  if(existing.data?.reaction===reaction){
    r=await sb.from('message_reactions').delete().eq('message_id',messageId).eq('user_id',user.id);
  }else{
    r=await sb.from('message_reactions').upsert({message_id:messageId,user_id:user.id,reaction},{onConflict:'message_id,user_id'});
  }
  if(r.error)alert(r.error.message);
  else await loadMessages();
}

async function deleteVoice(id,path){
  if(!confirm('Supprimer ce vocal ?'))return;
  try{
    const d=await sb.from('voice_messages').delete().eq('id',id).eq('user_id',user.id);
    if(d.error)throw d.error;
    const st=await sb.storage.from('event-voices').remove([path]);
    if(st.error)throw st.error;
    const local=voiceLocalUrls.get(String(id)); if(local){try{URL.revokeObjectURL(local)}catch{} voiceLocalUrls.delete(String(id));}
    await loadMessages();
  }catch(e){alert('Erreur suppression vocal : '+(e.message||String(e)))}
}

let mediaRecorder=null;
let voiceChunks=[];
let voiceStream=null;
let voiceBlob=null;
// V54.38 — URL locales conservées pour afficher immédiatement le vocal
// après l'envoi, même si la génération de l'URL Storage prend un instant.
const voiceLocalUrls=new Map();

function pickVoiceMime(){
  if(!window.MediaRecorder)return '';
  const types=['audio/mp4','audio/webm;codecs=opus','audio/webm'];
  return types.find(t=>MediaRecorder.isTypeSupported(t))||'';
}

function clearVoicePreview(){
  voiceBlob=null;
  const box=$('voicePreview');
  if(box){box.classList.add('hidden');box.innerHTML='';}
  const status=$('voiceStatus');
  if(status)status.textContent='';
  const hint=$('voiceCancelHint');
  if(hint)hint.textContent='';
  const cancel=$('cancelRecordingBtn');
  if(cancel)cancel.classList.add('hidden');
}

function stopVoiceStream(){
  if(voiceStream){voiceStream.getTracks().forEach(t=>t.stop());voiceStream=null;}
}

function formatVoiceDuration(ms){
  if(!Number.isFinite(ms)||ms<=0)return '';
  const total=Math.round(ms/1000);
  const min=Math.floor(total/60);
  const sec=String(total%60).padStart(2,'0');
  return min+':'+sec;
}

function getVoiceSpeed(){
  const v=parseFloat(localStorage.getItem('myevent_voice_speed')||'1');
  return [1,1.5,2].includes(v)?v:1;
}

function bindVoiceSpeeds(root=document){
  const speeds=[1,1.5,2];
  const labels={1:'1×',1.5:'1,5×',2:'2×'};
  const speed=getVoiceSpeed();
  root.querySelectorAll('.voiceSpeed').forEach(button=>{
    const initial=speeds.includes(parseFloat(button.dataset.speed))?parseFloat(button.dataset.speed):speed;
    button.dataset.speed=String(initial);
    button.textContent=labels[initial];
    button.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      const current=parseFloat(button.dataset.speed)||1;
      const next=speeds[(speeds.indexOf(current)+1)%speeds.length];
      button.dataset.speed=String(next);
      button.textContent=labels[next];
      localStorage.setItem('myevent_voice_speed',String(next));
      const scope=button.closest('.voiceMessage,.voicePreview')||root;
      scope.querySelectorAll('audio').forEach(a=>{a.playbackRate=next;});
    });
    const scope=button.closest('.voiceMessage,.voicePreview')||root;
    scope.querySelectorAll('audio').forEach(a=>{a.playbackRate=initial;});
  });
}

let voiceStartedAt=0;
let voiceTimer=null;

function updateVoiceTimer(){
  const elapsed=Math.max(0,Date.now()-voiceStartedAt);
  const total=Math.floor(elapsed/1000);
  const min=String(Math.floor(total/60)).padStart(2,'0');
  const sec=String(total%60).padStart(2,'0');
  const text=$('voiceRecordingText');
  if(text)text.textContent=min+':'+sec;
  const status=$('voiceStatus');
  if(status)status.textContent='';
}

function resetVoiceRecordingUi(){
  clearInterval(voiceTimer);
  voiceTimer=null;
  voiceStartedAt=0;
  const btn=$('voiceBtn');
  const cancel=$('cancelRecordingBtn');
  const composer=document.querySelector('#discussionContent .chatComposer');
  const bar=$('voiceRecordingBar');
  if(btn){btn.disabled=false;btn.classList.remove('recording','cancelZone');btn.textContent='🎙️';}
  if(cancel)cancel.classList.add('hidden');
  if(composer)composer.classList.remove('isRecording');
  if(bar){bar.classList.add('hidden');}
   const recText=$('voiceRecordingText');if(recText)recText.textContent='00:00';
   const status=$('voiceStatus');if(status)status.textContent='';
   const hint=$('voiceCancelHint');if(hint)hint.textContent='';
}

function cancelVoiceRecording(){
  if(mediaRecorder && mediaRecorder.state==='recording'){
    mediaRecorder.onstop=null;
    try{mediaRecorder.stop()}catch{}
  }
  stopVoiceStream();
  mediaRecorder=null;
  voiceChunks=[];
  voiceBlob=null;
  resetVoiceRecordingUi();
  const status=$('voiceStatus');
  if(status)status.textContent='Enregistrement annulé';
  setTimeout(()=>{if($('voiceStatus'))$('voiceStatus').textContent='';},1200);
}

let voiceTouchActive=false;
let voiceTouchStartX=0;
let voiceTouchStartY=0;
let voiceTouchCancelled=false;
let voiceHoldTimer=null;
let voiceHoldStarted=false;

function setVoiceCancelHint(show){
  const h=$('voiceCancelHint');
  if(h)h.textContent=show?'← Glisse vers la gauche pour annuler':'';
}

function cancelVoiceFromGesture(){
  voiceTouchCancelled=true;
  cancelVoiceRecording();
  setVoiceCancelHint(false);
}

async function toggleVoiceRecording(){
  if(!event||!user){alert('Connecte-toi et sélectionne un événement.');return}
  const btn=$('voiceBtn');
  if(mediaRecorder && mediaRecorder.state==='recording'){
    mediaRecorder.stop();
    btn.disabled=true;
    $('voiceStatus').textContent='Préparation du vocal…';
    clearInterval(voiceTimer);voiceTimer=null;
    const cancel=$('cancelRecordingBtn');if(cancel)cancel.classList.add('hidden');
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    alert('Ton navigateur ne permet pas l’enregistrement vocal. Utilise Safari récent sur iPhone.');
    return;
  }
  clearVoicePreview();
  try{
    // Le navigateur/iOS mémorise l'autorisation au niveau du site. On ne redemande
    // pas inutilement une permission si elle est déjà accordée.
    if(navigator.permissions?.query){
      try{
        const perm=await navigator.permissions.query({name:'microphone'});
        if(perm.state==='denied')throw new Error('Accès au micro refusé dans les réglages du navigateur.');
      }catch(e){
        if(e?.message==='Accès au micro refusé dans les réglages du navigateur.')throw e;
      }
    }
    voiceStream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mime=pickVoiceMime();
    mediaRecorder=mime?new MediaRecorder(voiceStream,{mimeType:mime}):new MediaRecorder(voiceStream);
    voiceChunks=[];
    mediaRecorder.ondataavailable=e=>{if(e.data?.size)voiceChunks.push(e.data)};
    mediaRecorder.onstop=async()=>{
      clearInterval(voiceTimer);voiceTimer=null;
      const type=mediaRecorder.mimeType||mime||'audio/webm';
      voiceBlob=new Blob(voiceChunks,{type});
      stopVoiceStream();
      mediaRecorder=null;
      resetVoiceRecordingUi();
      // Snapchat-like : au relâchement, le vocal est envoyé directement.
      await sendVoice();
    };
    mediaRecorder.onerror=e=>{stopVoiceStream();mediaRecorder=null;resetVoiceRecordingUi();$('voiceStatus').textContent='';alert('Erreur enregistrement vocal.');};
    mediaRecorder.start();
    voiceStartedAt=Date.now();
    updateVoiceTimer();
    voiceTimer=setInterval(updateVoiceTimer,250);
    const composer=document.querySelector('#discussionContent .chatComposer');
    const bar=$('voiceRecordingBar');
    if(composer)composer.classList.add('isRecording');
    if(bar)bar.classList.remove('hidden');
    btn.classList.add('recording');
    btn.textContent='⏺️';
    const cancel=$('cancelRecordingBtn');if(cancel)cancel.classList.add('hidden');
  }catch(e){stopVoiceStream();mediaRecorder=null;resetVoiceRecordingUi();alert('Micro inaccessible : '+(e.message||String(e)));}
}
async function sendVoice(){
  if(!voiceBlob||!event||!user)return;
  const btn=$('voiceBtn');
  if(btn)btn.disabled=true;
  const recText=$('voiceRecordingText');
  if(recText)recText.textContent='Envoi du vocal…';
  let voiceStage='storage';
  try{
    const type=voiceBlob.type||'audio/webm';
    const ext=type.includes('mp4')?'m4a':'webm';
    const path=event.id+'/'+user.id+'/'+crypto.randomUUID()+'.'+ext;
    const up=await sb.storage.from('event-voices').upload(path,voiceBlob,{upsert:false,contentType:type});
    if(up.error)throw up.error;
    const durationMs=await new Promise(resolve=>{
      const a=document.createElement('audio');
      const url=URL.createObjectURL(voiceBlob);
      const done=()=>{const d=Number.isFinite(a.duration)?Math.round(a.duration*1000):null;URL.revokeObjectURL(url);resolve(d)};
      a.preload='metadata'; a.src=url; a.onloadedmetadata=done; a.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};
    });
    await ensureEventMembershipForChat();
    voiceStage='voice_messages';
    const ins=await sb.from('voice_messages').insert({event_id:event.id,user_id:user.id,storage_path:path,duration_ms:durationMs}).select('id').single();
    if(ins.error){await sb.storage.from('event-voices').remove([path]);throw ins.error;}
    rememberLocalCreated('voice',ins.data?.id);
    if(ins.data?.id && voiceBlob){
      try{voiceLocalUrls.set(String(ins.data.id),URL.createObjectURL(voiceBlob));}catch{}
    }
    clearVoicePreview();
    resetVoiceRecordingUi();
    await loadMessages();
  }catch(e){
    if(btn)btn.disabled=false;
    resetVoiceRecordingUi();
    const em=String(e?.message||e||'');
    if(/row-level security|violates row-level security/i.test(em)){
      if(voiceStage==='storage'){
        alert("Erreur vocal : le stockage « event-voices » bloque l’envoi par sa politique RLS. Le micro fonctionne ; il faut autoriser l’INSERT/UPLOAD pour les membres de l’événement dans Supabase.");
      }else{
        alert("Erreur vocal : la table voice_messages bloque l’enregistrement par sa politique RLS. Le micro fonctionne ; il faut autoriser l’INSERT pour les membres de l’événement dans Supabase.");
      }
    }else{
      alert('Erreur vocal : '+em);
    }
  }
}


// iPhone / touch: maintenir le bouton pour enregistrer, relâcher pour terminer.
(function bindVoiceHold(){
  const btn=$('voiceBtn');
  if(!btn)return;
  btn.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    e.preventDefault();
    voiceTouchActive=true;
    voiceTouchCancelled=false;
    voiceHoldStarted=false;
    voiceTouchStartX=e.touches[0].clientX;
    voiceTouchStartY=e.touches[0].clientY;
    clearTimeout(voiceHoldTimer);
    voiceHoldTimer=setTimeout(async()=>{
      if(!voiceTouchActive || voiceTouchCancelled)return;
      voiceHoldStarted=true;
      if(!(mediaRecorder&&mediaRecorder.state==='recording')) await toggleVoiceRecording();
    },300);
  },{passive:false});
  btn.addEventListener('touchmove',e=>{
    if(!voiceTouchActive||!e.touches.length)return;
    e.preventDefault();
    const dx=e.touches[0].clientX-voiceTouchStartX;
    const dy=Math.abs(e.touches[0].clientY-voiceTouchStartY);
    if(voiceHoldStarted && mediaRecorder&&mediaRecorder.state==='recording' && dx<-80 && dy<100){
      btn.classList.add('cancelZone');
      setVoiceCancelHint(true);
    }else{
      btn.classList.remove('cancelZone');
      setVoiceCancelHint(false);
    }
  },{passive:false});
  btn.addEventListener('touchend',e=>{
    if(!voiceTouchActive)return;
    e.preventDefault();
    const dx=(e.changedTouches[0]?.clientX||voiceTouchStartX)-voiceTouchStartX;
    const dy=Math.abs((e.changedTouches[0]?.clientY||voiceTouchStartY)-voiceTouchStartY);
    voiceTouchActive=false;
    clearTimeout(voiceHoldTimer);
    voiceHoldTimer=null;
    btn.classList.remove('cancelZone');
    if(mediaRecorder&&mediaRecorder.state==='recording'){
      if(dx<-80 && dy<100) cancelVoiceFromGesture();
      else toggleVoiceRecording();
    }
    voiceHoldStarted=false;
  },{passive:false});
  btn.addEventListener('touchcancel',()=>{
    voiceTouchActive=false;
    clearTimeout(voiceHoldTimer);
    voiceHoldTimer=null;
    voiceHoldStarted=false;
    btn.classList.remove('cancelZone');
    if(mediaRecorder&&mediaRecorder.state==='recording') cancelVoiceFromGesture();
  },{passive:true});
})();

// V26 — pièces jointes directement dans la discussion
(function initChatComposer(){
  const clip=document.getElementById('chatClipBtn');
  const menu=document.getElementById('chatAttachmentMenu');
  const camera=document.getElementById('chatCameraBtn');
  const gallery=document.getElementById('chatGalleryBtn');
  const fileBtn=document.getElementById('chatFileBtn');
  const pollBtn=document.getElementById('chatPollQuickBtn');
  const cameraInput=document.getElementById('chatCameraInput');
  const galleryInput=document.getElementById('chatGalleryInput');
  const fileInput=document.getElementById('chatFileInput');
  if(!clip||!menu)return;
  const close=()=>menu.classList.add('hidden');
  clip.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();menu.classList.toggle('hidden');});
  document.addEventListener('click',e=>{if(!e.target.closest('#chatAttachmentMenu')&&!e.target.closest('#chatClipBtn'))close();});
  camera?.addEventListener('click',()=>{close();cameraInput?.click();});
  gallery?.addEventListener('click',()=>{close();galleryInput?.click();});
  fileBtn?.addEventListener('click',()=>{close();fileInput?.click();});
  pollBtn?.addEventListener('click',()=>{close();document.querySelector('[data-tab="polls"]')?.click();});
  const handleFiles=async(input)=>{
    const files=Array.from(input?.files||[]); if(!files.length||!event||!user)return;
    try{
      for(const f of files){
        if(f.size>100*1024*1024){alert('Un fichier dépasse 100 Mo : '+f.name);continue;}
        const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const path=event.id+'/'+user.id+'/'+crypto.randomUUID()+'-'+safe;
        const up=await sb.storage.from('event-media').upload(path,f,{upsert:false,contentType:f.type||'application/octet-stream'});
        if(up.error)throw up.error;
        if((f.type||'').startsWith('image/')||(f.type||'').startsWith('video/')){
          const ins=await sb.from('media').insert({event_id:event.id,user_id:user.id,storage_path:path,media_type:f.type.startsWith('video/')?'video':'image'}).select('id').single();
          if(ins.error){await sb.storage.from('event-media').remove([path]);throw ins.error;}
          rememberLocalCreated('media',ins.data?.id);
        }
        const payload={path,name:f.name,type:f.type||'application/octet-stream'};
        const r=await sb.from('messages').insert({event_id:event.id,user_id:user.id,content:'[[MYEVENT_ATTACHMENT]]'+JSON.stringify(payload)}).select('id').single();
        if(r.error){await sb.storage.from('event-media').remove([path]);throw r.error;}
        rememberLocalCreated('messages',r.data?.id);
      }
      await loadMessages(); await loadMedia();
    }catch(e){alert('Erreur pièce jointe : '+(e.message||String(e)));}
    finally{if(input)input.value='';}
  };
  cameraInput?.addEventListener('change',()=>handleFiles(cameraInput));
  galleryInput?.addEventListener('change',()=>handleFiles(galleryInput));
  fileInput?.addEventListener('change',()=>handleFiles(fileInput));
})();

async function ensureEventMembershipForChat(){
  // V54.36 — ne jamais tenter un INSERT/UPSERT dans event_members depuis la
  // discussion : si la table est protégée par RLS, cette tentative peut échouer
  // et masquer ensuite la vraie erreur de voice_messages. Les adhésions sont
  // créées lors de la création/rejoindre l'événement.
  return true;
}

async function sendMessage(){
  if(!event){alert('Aucun événement actif. Recharge la page.');return}
  const c=$('message').value.trim();
  if(!c)return;
  setBusy('sendBtn',true,'…');
  try{
    await ensureEventMembershipForChat();
    const r=await sb.from('messages').insert({
      event_id:event.id,user_id:user.id,content:c
    }).select('id').single();
    if(r.error) throw r.error;
    rememberLocalCreated('messages',r.data?.id);
    $('message').value='';
    await loadMessages();
  }catch(e){alert('Erreur message : '+(e.message||String(e)))}
  finally{setBusy('sendBtn',false,'Envoyer')}
}

async function createPoll(){
  if(!event){alert('Aucun événement actif. Recharge la page.');return}
  const q=$('question').value.trim();
  const o=[...new Set($('options').value.split(',').map(x=>x.trim()).filter(Boolean))];
  const allowMultiple=!!$('allowMultiple')?.checked;
  if(!q||o.length<2){alert('Question + au moins 2 choix');return}
  setBusy('pollBtn',true,'Création…');
  try{
    const p=await sb.from('polls').insert({
      event_id:event.id,creator_id:user.id,question:q,allow_multiple:allowMultiple
    }).select().single();
    if(p.error) throw p.error;
    rememberLocalCreated('polls',p.data?.id);

    for(const x of o){
      const r=await sb.from('poll_options').insert({
        poll_id:p.data.id,option_text:x
      });
      if(r.error) throw r.error;
    }
    // Le même sondage apparaît dans la discussion sous forme de message,
    // tout en restant disponible dans l'onglet Sondages.
    const mr=await sb.from('messages').insert({
      event_id:event.id,user_id:user.id,
      content:'[[MYEVENT_POLL]]'+JSON.stringify({poll_id:p.data.id})
    }).select('id').single();
    if(mr.error) throw mr.error;
    rememberLocalCreated('messages',mr.data?.id);
    $('question').value='';
    $('options').value='';
    if($('allowMultiple'))$('allowMultiple').checked=false;
    await loadPolls();
    global('Sondage créé.','ok');
  }catch(e){alert('Erreur sondage : '+(e.message||String(e)))}
  finally{setBusy('pollBtn',false,'Créer le sondage')}
}

async function vote(pollId, optionId, button){
  if(!user || !event){
    global('Connecte-toi pour voter.','err');
    return;
  }
  document.querySelectorAll('.voteBtn').forEach(b=>b.disabled=true);
  try{
    const card=button?.closest('[data-poll-card]');
    const allowMultiple=card?.dataset.allowMultiple==='true';

    const existing=await sb.from('poll_votes')
      .select('poll_id,option_id,user_id')
      .eq('poll_id',pollId)
      .eq('user_id',user.id);
    if(existing.error) throw existing.error;
    const mine=existing.data||[];

    if(allowMultiple){
      const current=mine.find(v=>v.option_id===optionId);
      if(current){
        const d=await sb.from('poll_votes').delete()
          .eq('poll_id',pollId)
          .eq('option_id',optionId)
          .eq('user_id',user.id);
        if(d.error) throw d.error;
        global('Choix retiré ✓','ok');
      }else{
        const ins=await sb.from('poll_votes').insert({
          poll_id:pollId,
          option_id:optionId,
          user_id:user.id
        });
        if(ins.error) throw ins.error;
        global('Choix enregistré ✓','ok');
      }
    }else{
      // Une seule réponse : on remplace proprement l'ancien vote.
      const d=await sb.from('poll_votes').delete()
        .eq('poll_id',pollId)
        .eq('user_id',user.id);
      if(d.error) throw d.error;

      const ins=await sb.from('poll_votes').insert({
        poll_id:pollId,
        option_id:optionId,
        user_id:user.id
      });
      if(ins.error) throw ins.error;
      global('Vote enregistré ✓','ok');
    }
    await loadPolls();
  }catch(e){
    global('Erreur vote : '+(e.message||String(e)),'err');
    await loadPolls();
  }finally{
    document.querySelectorAll('.voteBtn').forEach(b=>b.disabled=false);
  }
}

async function uploadMedia(){
  if(!event||!user){msg('mediaMsg','Connecte-toi et sélectionne un événement.','err');return}
  const files=Array.from($('mediaInput').files||[]);
  if(!files.length){msg('mediaMsg','Choisis au moins une photo ou une vidéo.','err');return}
  if(files.some(f=>f.size>100*1024*1024)){msg('mediaMsg','Un fichier dépasse 100 Mo.','err');return}
  setBusy('mediaBtn',true,'Envoi…');
  try{
    for(const file of files){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=event.id+'/'+user.id+'/'+crypto.randomUUID()+'-'+safe;
      const up=await sb.storage.from('event-media').upload(path,file,{upsert:false,contentType:file.type});
      if(up.error) throw up.error;
      const ins=await sb.from('media').insert({
        event_id:event.id,user_id:user.id,storage_path:path,media_type:file.type.startsWith('video/')?'video':'image'
      }).select('id').single();
      if(ins.error){
        await sb.storage.from('event-media').remove([path]);
        throw ins.error;
      }
      rememberLocalCreated('media',ins.data?.id);
    }
    $('mediaInput').value='';
    msg('mediaMsg','Souvenir(s) ajouté(s) ✓','ok');
    await loadMedia();
  }catch(e){msg('mediaMsg','Erreur : '+(e.message||String(e)),'err')}
  finally{setBusy('mediaBtn',false,'📤 Ajouter')}
}

async function deleteMedia(id,path){
  if(!confirm('Supprimer ce média ?'))return;
  try{
    const d=await sb.from('media').delete().eq('id',id).eq('user_id',user.id);
    if(d.error)throw d.error;
    const st=await sb.storage.from('event-media').remove([path]);
    if(st.error)throw st.error;
    await loadMedia();
  }catch(e){msg('mediaMsg','Erreur suppression : '+(e.message||String(e)),'err')}
}

async function loadMedia(){
  if(!event)return;
  const r=await sb.from('media').select('id,user_id,storage_path,media_type,created_at').eq('event_id',event.id).order('created_at',{ascending:false});
  if(r.error){$('mediaGrid').innerHTML='<p class="err">'+esc(r.error.message)+'</p>';return}
  const items=(r.data||[]).filter(m=>m.media_type!=='audio');
  if(!items.length){$('mediaGrid').innerHTML='<p class="muted">Aucune photo ou vidéo pour le moment.</p>';return}
  const urls=await Promise.all(items.map(async m=>{
    const x=await sb.storage.from('event-media').createSignedUrl(m.storage_path,3600);
    return [m,x.data?.signedUrl||''];
  }));
  $('mediaGrid').innerHTML=urls.map(([m,url])=>{
    if(!url)return '';
    const mine=m.user_id===user.id;
    const media=m.media_type==='video'
      ? '<video src="'+esc(url)+'" controls playsinline preload="metadata"></video>'
      : '<img src="'+esc(url)+'" alt="Souvenir" loading="lazy">';
    return '<div class="mediaItem">'+media+(mine?'<button class="deleteMedia" data-id="'+m.id+'" data-path="'+esc(m.storage_path)+'">Supprimer</button>':'')+'<div class="mediaMeta">'+(mine?'Moi':'Membre')+'</div></div>';
  }).join('');
  document.querySelectorAll('.deleteMedia').forEach(b=>b.addEventListener('click',()=>deleteMedia(b.dataset.id,b.dataset.path)));
  if($('statPhotos'))$('statPhotos').textContent=items.length;
  await loadUnreadMediaCount();
}

async function loadPolls(){
  if(!event)return;

  // On récupère les sondages et leurs choix séparément.
  // Cela évite l'erreur Supabase « more than one relationship was found »
  // provoquée par plusieurs relations entre polls et poll_options.
  const pr=await sb.from('polls')
    .select('*')
    .eq('event_id',event.id)
    .order('created_at',{ascending:false});
  if(pr.error){
    $('polls').innerHTML='<p class="err">'+esc(pr.error.message)+'</p>';
    return;
  }

  const polls=pr.data||[];
  if(!polls.length){
    $('polls').innerHTML='<p class="muted">Aucun sondage pour le moment.</p>';
    await loadUnreadPollCount();
    return;
  }

  const ids=polls.map(p=>p.id);
  const or=await sb.from('poll_options')
    .select('id,poll_id,option_text')
    .in('poll_id',ids);
  if(or.error){
    $('polls').innerHTML='<p class="err">Choix du sondage indisponibles : '+esc(or.error.message)+'</p>';
    return;
  }

  const optionsByPoll=new Map();
  for(const o of (or.data||[])){
    if(!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id,[]);
    optionsByPoll.get(o.poll_id).push(o);
  }

  const vr=await sb.from('poll_votes')
    .select('poll_id,option_id,user_id')
    .in('poll_id',ids);
  if(vr.error){
    $('polls').innerHTML='<p class="err">Résultats indisponibles : '+esc(vr.error.message)+'</p>';
    return;
  }
  const votes=vr.data||[];

  $('polls').innerHTML=polls.map(p=>{
    const pv=votes.filter(v=>v.poll_id===p.id);
    const mine=pv.filter(v=>v.user_id===user.id).map(v=>v.option_id);
    const totalVotes=pv.length;
    const voterCount=new Set(pv.map(v=>v.user_id)).size;
    const options=(optionsByPoll.get(p.id)||[]).map(o=>{
      const count=pv.filter(v=>v.option_id===o.id).length;
      const pct=voterCount?Math.round(count*100/voterCount):0;
      const selected=mine.includes(o.id)?' selectedVote':'';
      return '<div class="pollOption">'+
        '<button type="button" class="secondary voteBtn'+selected+'" data-poll="'+p.id+'" data-option="'+o.id+'">'+
        (mine.includes(o.id)?'✓ ':'')+esc(o.option_text)+
        '<span class="pollCount">'+count+' vote'+(count>1?'s':'')+' · '+pct+'%</span>'+
        '</button>'+ 
        '<div class="pollBar"><div class="pollBarFill" style="width:'+pct+'%"></div></div>'+ 
        '</div>';
    }).join('');
    const mode=p.allow_multiple?'Plusieurs réponses possibles':'Une seule réponse';
    return '<div class="card" data-poll-card data-allow-multiple="'+(p.allow_multiple?'true':'false')+'" data-poll-question="'+esc(p.question)+'">'+
      '<b>'+esc(p.question)+'</b>'+ 
      '<p class="muted">'+mode+' · '+voterCount+' participant'+(voterCount>1?'s':'')+' · '+totalVotes+' vote'+(totalVotes>1?'s':'')+'</p>'+options+
      '<button type="button" class="secondary pollAnalyzeBtn" data-analyze-poll="'+p.id+'">✨ Analyser les résultats</button>'+ 
      '<div class="pollAiBox hidden" id="pollAi-'+p.id+'"></div></div>';
  }).join('');

  document.querySelectorAll('.voteBtn').forEach(b=>{
    b.addEventListener('click',()=>vote(b.dataset.poll,b.dataset.option,b));
  });
  document.querySelectorAll('.pollAnalyzeBtn').forEach(b=>{
    b.addEventListener('click',()=>analyzePollResults(b.dataset.analyzePoll));
  });
  await loadUnreadPollCount();
}

async function analyzePollResults(pollId){
  const box=$('pollAi-'+pollId), button=document.querySelector('[data-analyze-poll="'+pollId+'"]');
  if(!box||!button||!event)return;
  box.classList.remove('hidden');
  box.innerHTML='<b>✨ Analyse du groupe</b><p>Analyse des résultats…</p>';
  button.disabled=true;
  try{
    const pr=await sb.from('polls').select('id,question,allow_multiple').eq('id',pollId).eq('event_id',event.id).single();
    if(pr.error)throw pr.error;
    const ors=await sb.from('poll_options').select('id,option_text').eq('poll_id',pollId);
    if(ors.error)throw ors.error;
    const vrs=await sb.from('poll_votes').select('option_id,user_id').eq('poll_id',pollId);
    if(vrs.error)throw vrs.error;
    const options=ors.data||[], votes=vrs.data||[];
    const voterCount=new Set(votes.map(v=>v.user_id)).size;
    const results=options.map(o=>({text:o.option_text,votes:votes.filter(v=>v.option_id===o.id).length}));
    const r=await fetch('/api/analyze-poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName:event.name||'Événement',poll:{question:pr.data.question,allow_multiple:!!pr.data.allow_multiple,voterCount,totalVotes:votes.length,results}})});
    const data=await r.json();
    if(!r.ok)throw new Error(data?.error||'Erreur du service IA.');
    const choice=String(data.decision||'').trim();
    box.innerHTML='<b>✨ Analyse du groupe</b><p>'+esc(data.analysis||'Aucune analyse disponible.')+'</p>'+
      (choice?'<p><b>➡️ Décision proposée :</b> '+esc(choice)+'</p>'+
        '<div class="pollDecisionActions">'+
        '<button type="button" class="secondary pollValidateBtn">✓ Valider la proposition</button>'+
        '</div>':'');
    if(choice){
      box.querySelector('.pollValidateBtn')?.addEventListener('click',()=>validatePollDecision({
        pollId,
        question:pr.data.question,
        choice,
        reason:data.analysis||'',
        action:choice,
        container:box
      }));
    }
  }catch(e){
    console.warn('Analyse sondage:',e.message||e);
    box.innerHTML='<b>✨ Analyse du groupe</b><p class="err">'+esc(e.message||'Impossible d’analyser ce sondage.')+'</p>';
  }finally{button.disabled=false;}
}

async function analyzeAllPolls(){
  const box=$('pollAiGlobalBox'), button=$('pollAiGlobalBtn');
  if(!box||!button||!event)return;
  box.classList.remove('hidden');
  box.innerHTML='<b>✨ Analyse IA du groupe</b><p>Analyse de tous les sondages…</p>';
  button.disabled=true;
  try{
    const pr=await sb.from('polls').select('id,question,allow_multiple,created_at').eq('event_id',event.id).order('created_at',{ascending:true});
    if(pr.error)throw pr.error;
    const polls=pr.data||[];
    if(!polls.length){box.innerHTML='<b>✨ Analyse IA du groupe</b><p>Aucun sondage à analyser.</p>';return;}
    const ids=polls.map(p=>p.id);
    const [or,vr]=await Promise.all([
      sb.from('poll_options').select('id,poll_id,option_text').in('poll_id',ids),
      sb.from('poll_votes').select('poll_id,option_id,user_id').in('poll_id',ids)
    ]);
    if(or.error)throw or.error;
    if(vr.error)throw vr.error;
    const options=or.data||[], votes=vr.data||[];
    const payloadPolls=polls.map(p=>{
      const po=options.filter(o=>o.poll_id===p.id);
      const pv=votes.filter(v=>v.poll_id===p.id);
      const voterCount=new Set(pv.map(v=>v.user_id)).size;
      return {question:p.question,allow_multiple:!!p.allow_multiple,voterCount,totalVotes:pv.length,
        results:po.map(o=>({text:o.option_text,votes:pv.filter(v=>v.option_id===o.id).length}))};
    });
    const r=await fetch('/api/analyze-poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName:event.name||'Événement',polls:payloadPolls})});
    const data=await r.json();
    if(!r.ok)throw new Error(data?.error||'Erreur du service IA.');
    const decisions=Array.isArray(data.decisions)?data.decisions:[];
    box.innerHTML='<b>✨ Analyse IA du groupe</b>'+
      (data.summary?'<p>'+esc(data.summary)+'</p>':'')+
      (decisions.length?'<div>'+decisions.map((d,i)=>'<div class="missedSummary pollDecisionCard" data-decision-index="'+i+'"><b>'+(i+1)+'. '+esc(d.question||'Sondage')+'</b>'+
        '<div><b>Choix recommandé :</b> '+esc(d.best_choice||'Aucun consensus')+'</div>'+
        (d.reason?'<div class="notificationDetail">'+esc(d.reason)+'</div>':'')+
        (d.action?'<div class="notificationDetail"><b>Action proposée :</b> '+esc(d.action)+'</div>':'')+
        ((d.best_choice&&d.best_choice!=='Aucun consensus')?'<button type="button" class="secondary pollValidateBtn">✓ Valider la proposition</button>':'')+
        '</div>').join('')+'</div>':'<p>Aucune décision fiable ne peut encore être proposée.</p>');

    box.querySelectorAll('.pollDecisionCard').forEach((card,i)=>{
      const d=decisions[i];
      if(!d || !d.best_choice || d.best_choice==='Aucun consensus')return;
      card.querySelector('.pollValidateBtn')?.addEventListener('click',()=>validatePollDecision({
        question:d.question||'Sondage',
        choice:d.best_choice,
        reason:d.reason||'',
        action:d.action||'',
        container:card
      }));
    });
  }catch(e){
    console.warn('Analyse globale des sondages:',e.message||e);
    box.innerHTML='<b>✨ Analyse IA du groupe</b><p class="err">'+esc(e.message||'Impossible d’analyser les sondages.')+'</p>';
  }finally{button.disabled=false;}
}

document.getElementById('pollAiGlobalBtn')?.addEventListener('click',analyzeAllPolls);

function pollActionDisplay(action,choice){
  const a=String(action||'').trim();
  const c=String(choice||'').trim();
  if(!a)return '';
  if(c){
    const re=new RegExp('^'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*(?:[—–-]\\s*)?','i');
    const cleaned=a.replace(re,'').trim();
    if(cleaned && cleaned.toLowerCase()!==c.toLowerCase())return cleaned;
    if(!cleaned)return '';
  }
  return a;
}

async function validatePollDecision({pollId=null,question='',choice='',reason='',action='',container=null}){
  if(!event||!user){alert('Connecte-toi pour valider une décision.');return;}
  if(event.creator_id!==user.id){alert('Seul l’organisateur peut valider une proposition IA.');return;}

  const cleanQuestion=String(question||'Sondage').trim();
  const cleanChoice=String(choice||'Aucun consensus').trim();
  const cleanReason=String(reason||'').trim();
  const cleanAction=String(action||'').trim();

  if(!cleanChoice || cleanChoice==='Aucun consensus'){
    alert('Il n’y a pas de consensus fiable à valider.');
    return;
  }

  const btn=container?.querySelector('.pollValidateBtn');
  if(btn){btn.disabled=true;btn.textContent='Validation…';}

  try{
    const payload={
      poll_id:pollId,
      question:cleanQuestion,
      choice:cleanChoice,
      reason:cleanReason,
      action:cleanAction,
      validated_at:new Date().toISOString()
    };

    const content='[[MYEVENT_AI_DECISION]]'+JSON.stringify(payload);
    const r=await sb.from('messages').insert({
      event_id:event.id,
      user_id:user.id,
      content
    }).select('id').single();
    if(r.error)throw r.error;
    rememberLocalCreated('messages',r.data?.id);

    if(container){
      container.querySelectorAll('.pollValidateBtn').forEach(x=>x.remove());
      const actions=document.createElement('div');
      actions.className='pollDecisionActions';
      actions.innerHTML='<span class="pollDecisionValidated">✓ Proposition validée par l’organisateur</span>'+
        '<button type="button" class="secondary pollActionBtn">⚡ Transformer en action</button>';
      container.appendChild(actions);
      actions.querySelector('.pollActionBtn')?.addEventListener('click',()=>executePollAction({
        pollId,question:cleanQuestion,choice:cleanChoice,reason:cleanReason,action:cleanAction,container:actions
      }));
    }

    global('Proposition validée.','ok');
    await loadMessages();
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='✓ Valider la proposition';}
    alert('Erreur lors de la validation : '+(e.message||String(e)));
  }
}

async function executePollAction({pollId=null,question='',choice='',reason='',action='',container=null}){
  if(!event||!user)return;
  if(event.creator_id!==user.id){alert('Seul l’organisateur peut transformer la décision en action.');return;}

  const cleanQuestion=String(question||'Sondage').trim();
  const cleanChoice=String(choice||'').trim();
  const cleanAction=String(action||'').trim();
  const btn=container?.querySelector('.pollActionBtn');
  if(btn){btn.disabled=true;btn.textContent='Création…';}

  try{
    const payload={
      poll_id:pollId,
      question:cleanQuestion,
      choice:cleanChoice,
      action:cleanAction,
      created_at:new Date().toISOString()
    };

    const content='[[MYEVENT_AI_ACTION]]'+JSON.stringify(payload);
    const r=await sb.from('messages').insert({
      event_id:event.id,
      user_id:user.id,
      content
    }).select('id').single();
    if(r.error)throw r.error;
    rememberLocalCreated('messages',r.data?.id);

    if(container){
      container.querySelectorAll('.pollActionBtn').forEach(x=>x.remove());
      const done=document.createElement('span');
      done.className='pollDecisionValidated';
      done.textContent='⚡ Action créée et publiée dans l’événement';
      container.appendChild(done);
    }

    global('Action créée et publiée dans l’événement.','ok');
    await loadMessages();
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='⚡ Transformer en action';}
    alert('Erreur lors de la création de l’action : '+(e.message||String(e)));
  }
}


function formatNotificationTime(value){
  if(!value)return '';
  try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
  catch{return '';}
}

let missedSummaryHtml='';

function renderNotificationList(items, summary=null){
  const box=$('notificationList'); if(!box)return;
  const html=items.length
    ? items.map(x=>'<div class="notificationItem" data-tab="'+esc(x.tab||'')+'">'+
        '<div class="notificationIcon">'+x.icon+'</div><div><b>'+esc(x.title)+'</b>'+
        '<span class="notificationDetail">'+esc(x.detail)+'</span>'+
        (x.time?'<span class="notificationTime">'+esc(formatNotificationTime(x.time))+'</span>':'')+
        '</div></div>').join('')
    : '<div class="notificationEmpty muted">Aucune nouvelle activité.</div>';
  const finalSummary = summary===null ? missedSummaryHtml : summary;
  box.innerHTML=html+(finalSummary?'<div class="missedSummary"><b>✨ Ce que tu as raté</b><div>'+finalSummary+'</div></div>':'');
  box.querySelectorAll('.notificationItem[data-tab]').forEach(item=>item.addEventListener('click',async()=>{
    const tab=item.dataset.tab;
    if(tab){showEventTab(tab); const panel=document.querySelector('.tabPanel[data-panel="'+tab+'"]'); if(panel)setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),40);}
  }));
}

async function generateMissedAiSummary(context){
  const box=$('notificationList');
  if(!box)return;
  missedSummaryHtml='<p class="muted">Analyse de l’activité…</p>';
  const previous=box.querySelector('.missedSummary');
  if(previous)previous.remove();
  const wrap=document.createElement('div');
  wrap.className='missedSummary';
  wrap.innerHTML='<b>✨ Ce que tu as raté</b>'+missedSummaryHtml;
  box.appendChild(wrap);
  try{
    const r=await fetch('/api/summarize-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName:event?.name||'Événement',context})});
    const data=await r.json();
    if(!r.ok)throw new Error(data?.error||'Erreur du service IA.');
    missedSummaryHtml='<div>'+esc(data.summary||'Aucun résumé disponible.')+'</div>';
    wrap.innerHTML='<b>✨ Ce que tu as raté</b>'+missedSummaryHtml;
  }catch(e){
    console.warn('Résumé IA:',e.message||e);
    const fallback=context.messages.length||context.polls.length||context.mediaCount||context.members.length
      ? '• '+(context.messages.length?context.messages.length+' nouveau(x) message(s). ':'')+(context.polls.length?context.polls.length+' nouveau(x) sondage(s). ':'')+(context.mediaCount?context.mediaCount+' nouveau(x) souvenir(s). ':'')+(context.members.length?context.members.length+' nouveau(x) participant(s).':'')
      : '• Rien de nouveau à rattraper.';
    missedSummaryHtml='<div>'+esc(fallback)+'</div><p class="muted">Le résumé IA sera disponible dès que le service est configuré.</p>';
    wrap.innerHTML='<b>✨ Ce que tu as raté</b>'+missedSummaryHtml;
  }
}

async function refreshNotifications(showSummary=false){
  if(!event||!user)return;
  const items=[], context={eventName:event.name||'Événement',messages:[],polls:[],mediaCount:0,members:[]};
  try{
    const mr=await sb.from('message_reads').select('last_read_at').eq('event_id',event.id).eq('user_id',user.id).maybeSingle();
    const lastRead=mr.data?.last_read_at||null;
    let mcq=sb.from('messages').select('id,created_at,user_id',{count:'exact'}).eq('event_id',event.id);
    if(lastRead)mcq=mcq.gt('created_at',lastRead);
    const mcres=await mcq;
    const unreadMessages=(mcres.data||[]).filter(x=>!isLocallyCreated('messages',x.id)).length;
    let mq=sb.from('messages').select('id,content,created_at,user_id').eq('event_id',event.id).order('created_at',{ascending:false}).limit(50);
    if(lastRead)mq=mq.gt('created_at',lastRead);
    const mres=await mq;
    const msgs=(mres.data||[]).filter(x=>!isLocallyCreated('messages',x.id)).slice(0,10);
    if(unreadMessages){
      const ids=[...new Set(msgs.map(x=>x.user_id).filter(Boolean))]; let profiles=[];
      if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids);if(!pr.error)profiles=pr.data||[];}
      const pmap=new Map(profiles.map(p=>[p.id,p])); const first=msgs[0], fp=pmap.get(first.user_id)||{};
      const sender=first.user_id===user.id?'Moi':(fp.display_name||fp.username||'Un membre');
      items.push({icon:'💬',tab:'discussion',title:unreadMessages+(unreadMessages>1?' nouveaux messages':' nouveau message'),detail:sender+' : '+(first.content||'').slice(0,100)+(unreadMessages>10?' · aperçu des 10 derniers':'') ,time:first.created_at});
      context.messages=msgs.slice().reverse().map(x=>({content:x.content||'',created_at:x.created_at}));
    }

    const pk=unreadStorageKey('polls'), ps=localStorage.getItem(pk);
    let pq=sb.from('polls').select('id,question,created_at,creator_id').eq('event_id',event.id).order('created_at',{ascending:false}).limit(50);
    if(ps)pq=pq.gt('created_at',ps);
    const pres=await pq, polls=(pres.data||[]).filter(x=>!isLocallyCreated('polls',x.id));
    if(polls.length){
      const ids=[...new Set(polls.map(x=>x.creator_id).filter(Boolean))]; let profiles=[];
      if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids);if(!pr.error)profiles=pr.data||[];}
      const pmap=new Map(profiles.map(p=>[p.id,p])); const first=polls[0], fp=pmap.get(first.creator_id)||{};
      const creator=fp.display_name||fp.username||'Un membre';
      items.push({icon:'📊',tab:'polls',title:polls.length+(polls.length>1?' nouveaux sondages':' nouveau sondage'),detail:creator+' : '+(first.question||'Nouveau sondage'),time:first.created_at});
      const pollIds=polls.map(x=>x.id);
      let pollOptions=[];
      if(pollIds.length){
        const ors=await sb.from('poll_options').select('id,poll_id,option_text').in('poll_id',pollIds);
        if(!ors.error)pollOptions=ors.data||[];
      }
      let pollVotes=[];
      if(pollIds.length){
        const vrs=await sb.from('poll_votes').select('poll_id,option_id').in('poll_id',pollIds);
        if(!vrs.error)pollVotes=vrs.data||[];
      }
      context.polls=polls.slice().reverse().map(x=>({
        question:x.question||'',
        created_at:x.created_at,
        results:pollOptions.filter(o=>o.poll_id===x.id).map(o=>({
          text:o.option_text,
          votes:pollVotes.filter(v=>v.poll_id===x.id&&v.option_id===o.id).length
        }))
      }));
    }

    const vk=unreadStorageKey('votes'), vs=localStorage.getItem(vk);
    if(vs){
      const pr=await sb.from('polls').select('id,question').eq('event_id',event.id).eq('creator_id',user.id);
      if(!pr.error && pr.data?.length){
        const pollIds=pr.data.map(x=>x.id);
        const vr=await sb.from('poll_votes').select('poll_id,user_id,option_id,created_at').in('poll_id',pollIds).neq('user_id',user.id).gt('created_at',vs).order('created_at',{ascending:false}).limit(50);
        const votes=vr.error?[]:(vr.data||[]);
        if(votes.length){
          const vmap=new Map((pr.data||[]).map(p=>[p.id,p]));
          const first=votes[0], vp=vmap.get(first.poll_id)||{};
          const ids=[...new Set(votes.map(x=>x.user_id).filter(Boolean))]; let profiles=[];
          if(ids.length){const pfr=await sb.from('profiles').select('id,display_name,username').in('id',ids);if(!pfr.error)profiles=pfr.data||[];}
          const pmap=new Map(profiles.map(p=>[p.id,p])); const person=pmap.get(first.user_id)||{};
          const voter=person.display_name||person.username||'Un participant';
          items.push({icon:'🗳️',tab:'polls',title:votes.length+(votes.length>1?' nouveaux votes':' nouveau vote'),detail:voter+' a voté à « '+(vp.question||'Sondage')+' »',time:first.created_at});
          const ors=await sb.from('poll_options').select('id,poll_id,option_text').in('poll_id',pollIds);
          const options=ors.error?[]:(ors.data||[]);
          const counts=new Map();
          votes.forEach(v=>counts.set(v.option_id,(counts.get(v.option_id)||0)+1));
          const optionMap=new Map(options.map(o=>[o.id,o]));
          const grouped=new Map();
          votes.forEach(v=>{
            if(!grouped.has(v.poll_id))grouped.set(v.poll_id,[]);
            grouped.get(v.poll_id).push(v);
          });
          grouped.forEach((list,pollId)=>{
            const poll=vmap.get(pollId)||{};
            const allOptions=options.filter(o=>o.poll_id===pollId).map(o=>({text:o.option_text,votes:counts.get(o.id)||0}));
            context.polls.push({question:poll.question||'Sondage',created_at:list[0]?.created_at,kind:'vote',results:allOptions});
          });
        }
      }
    }

    const mk=unreadStorageKey('media'), ms=localStorage.getItem(mk);
    let medq=sb.from('media').select('id,media_type,created_at,user_id').eq('event_id',event.id).order('created_at',{ascending:false}).limit(50);
    if(ms)medq=medq.gt('created_at',ms);
    const medres=await medq, media=(medres.data||[]).filter(x=>!isLocallyCreated('media',x.id));
    if(media.length){
      const ids=[...new Set(media.map(x=>x.user_id).filter(Boolean))]; let profiles=[];
      if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids);if(!pr.error)profiles=pr.data||[];}
      const pmap=new Map(profiles.map(p=>[p.id,p])); const first=media[0], fp=pmap.get(first.user_id)||{};
      const creator=fp.display_name||fp.username||'Un membre';
      items.push({icon:'📸',tab:'media',title:media.length+(media.length>1?' nouveaux souvenirs':' nouveau souvenir'),detail:creator+' : '+(media.some(x=>x.media_type==='video')?'photo(s) et/ou vidéo(s) ajoutée(s)':'nouvelle photo ajoutée'),time:first.created_at});
      context.mediaCount=media.length;
    }

    const memKey=unreadStorageKey('members'), memSaved=localStorage.getItem(memKey);
    let memq=sb.from('event_members').select('user_id,joined_at').eq('event_id',event.id).order('joined_at',{ascending:false}).limit(50);
    if(memSaved)memq=memq.gt('joined_at',memSaved);
    const memres=await memq, members=(memres.data||[]).filter(x=>!isLocallyCreated('members',x.user_id+'|'+x.joined_at));
    // À la première ouverture, les membres déjà présents ne sont pas considérés comme nouveaux.
    if(!memSaved){
      const latest=members[0]?.joined_at;
      if(latest)localStorage.setItem(memKey,latest);
    } else if(members.length){
      const ids=[...new Set(members.map(x=>x.user_id).filter(Boolean))]; let profiles=[];
      if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids);if(!pr.error)profiles=pr.data||[];}
      const pmap=new Map(profiles.map(p=>[p.id,p])); const first=members[0], fp=pmap.get(first.user_id)||{};
      const name=first.user_id===user.id?'Toi':(fp.display_name||fp.username||'Un participant');
      items.push({icon:'👥',tab:'members',title:members.length+(members.length>1?' nouveaux participants':' nouveau participant'),detail:name+' a rejoint l’événement',time:first.joined_at});
      context.members=members.map(x=>({joined_at:x.joined_at}));
    }

    items.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0));
    renderNotificationList(items);
    if(showSummary) await generateMissedAiSummary(context);
  }catch(e){console.warn('Notifications:',e.message||e);renderNotificationList([]);}
}

async function markAllNotificationsRead(){
  if(!event||!user)return;
  await markDiscussionRead(); await markPollsRead(); await markMediaRead();
  await markMembersRead();
  await refreshNotifications(false);
}




// V16 — indicateur « 💬 quelqu’un écrit… »
const typingUsers=new Map();
let typingSendTimer=null;
function renderTypingIndicator(){
  const box=document.getElementById('discussionTyping'), text=document.getElementById('discussionTypingText');
  if(!box||!text)return;
  const now=Date.now();
  for(const [id,v] of typingUsers){if(v.until<=now)typingUsers.delete(id)}
  const names=[...typingUsers.values()].map(v=>v.name);
  if(!names.length){box.classList.remove('show');return}
  text.textContent=names.length===1?names[0]+' écrit…':names.length===2?names.join(' et ')+' écrivent…':names.length+' personnes écrivent…';
  box.classList.add('show');
  clearTimeout(renderTypingIndicator._timer);
  renderTypingIndicator._timer=setTimeout(renderTypingIndicator,2300);
}
async function sendTypingSignal(){
  if(!realtimeChannel||!user)return;
  try{await realtimeChannel.send({type:'broadcast',event:'typing',payload:{user_id:user.id,name:user.pseudo||user.name||user.username||'Quelqu’un'}})}catch{}
}
function setupTypingInput(){
  const input=document.getElementById('message');
  if(!input||input.dataset.typingReady)return;
  input.dataset.typingReady='1';
  input.addEventListener('input',()=>{
    if(!input.value.trim())return;
    clearTimeout(typingSendTimer);
    sendTypingSignal();
    typingSendTimer=setTimeout(()=>{},900);
  });
}

function subscribeRealtime(){
  if(!sb||!event)return;
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null;}

  if(notificationPollTimer) clearInterval(notificationPollTimer);
  notificationPollTimer=setInterval(()=>{ if(event&&user) refreshNotifications(false); },4000);

  realtimeChannel=sb.channel('event-'+event.id)
    .on('broadcast',{event:'typing'},({payload})=>{
      if(!payload||payload.user_id===user?.id)return;
      typingUsers.set(payload.user_id,{name:payload.name||'Quelqu’un',until:Date.now()+2200});
      renderTypingIndicator();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'event_id=eq.'+event.id},async()=>{ await loadMessages(); await refreshNotifications(false); })
    .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},async()=>{ await loadMessages(); })
    .on('postgres_changes',{event:'*',schema:'public',table:'polls',filter:'event_id=eq.'+event.id},async()=>{ await loadPolls(); await refreshNotifications(false); })
    .on('postgres_changes',{event:'*',schema:'public',table:'poll_options'},()=>loadPolls())
    .on('postgres_changes',{event:'*',schema:'public',table:'poll_votes'},async()=>{ await loadPolls(); await refreshNotifications(false); })
    .on('postgres_changes',{event:'*',schema:'public',table:'event_members',filter:'event_id=eq.'+event.id},async()=>{ await loadMembers(); await refreshNotifications(false); })
    .on('postgres_changes',{event:'*',schema:'public',table:'media',filter:'event_id=eq.'+event.id},async()=>{ await loadMedia(); await loadMessages(); await refreshNotifications(false); })
  .on('postgres_changes',{event:'*',schema:'public',table:'voice_messages',filter:'event_id=eq.'+event.id},async()=>{ await loadMessages(); await refreshNotifications(false); })
    .subscribe((status)=>{
      if(status==='SUBSCRIBED'){ global('Discussion et sondages en temps réel.','ok'); setupTypingInput(); }
    });
}



setupTypingInput();
$('missedBtn').addEventListener('click',()=>{ missedSummaryHtml=''; refreshNotifications(true); });
$('markNotificationsReadBtn').addEventListener('click',markAllNotificationsRead);

async function logout(){
  try{
    if(realtimeChannel){await sb.removeChannel(realtimeChannel);realtimeChannel=null;}
    if(notificationPollTimer){clearInterval(notificationPollTimer);notificationPollTimer=null;}
    await sb.auth.signOut();
    sessionStorage.removeItem('myevent_restore_view');
    user=null; event=null;
    document.body.classList.remove('discussionFullScreen');
    $('main').classList.add('hidden');
    $('main').classList.remove('mainVisible');
    $('auth').classList.remove('hidden');
    $('profileSettingsCard').classList.remove('profileSettingsVisible','profileSettingsOpen');
    window.scrollTo(0,0);
  }catch(e){
    alert('Erreur de déconnexion : '+(e.message||String(e)));
  }
}

$('connectBtn').addEventListener('click',connect);
window.addEventListener('load',()=>connect());
$('signupBtn').addEventListener('click',signup);
$('loginBtn').addEventListener('click',login);
function showLocationMap(lat,lon){
  const map=$('createLocationMap'), frame=$('createLocationMapFrame'), link=$('createLocationMapLink');
  if(!map||!frame||!link)return;
  const d=0.004;
  const bbox=[lon-d,lat-d,lon+d,lat+d].join('%2C');
  frame.src='https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&layer=mapnik&marker='+encodeURIComponent(lat+','+lon);
  link.href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+'&mlon='+encodeURIComponent(lon)+'#map=17/'+encodeURIComponent(lat)+'/'+encodeURIComponent(lon);
  map.classList.remove('hidden');
}

const useLocationBtn=$('useLocationBtn');
if(useLocationBtn){
  useLocationBtn.addEventListener('click',()=>{
    const hint=$('locationHint');
    if(!navigator.geolocation){hint.textContent='La géolocalisation n’est pas disponible sur cet appareil.';return;}
    hint.textContent='📍 Recherche de ta position…';
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const lat=pos.coords.latitude.toFixed(6),lon=pos.coords.longitude.toFixed(6);
        showLocationMap(Number(lat),Number(lon));
        const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=18&addressdetails=1',{headers:{'Accept':'application/json'}});
        if(!r.ok) throw new Error('reverse geocoding');
        const d=await r.json();
        const a=d.address||{};
        const label=d.display_name||[a.road,a.house_number,a.postcode,a.city||a.town||a.village].filter(Boolean).join(', ');
        $('place').value=label||('Position : '+lat+', '+lon);
        hint.textContent='✅ Lieu trouvé. Tu peux encore le modifier avant de créer l’événement.';
      }catch(e){
        $('place').value=pos.coords.latitude.toFixed(6)+', '+pos.coords.longitude.toFixed(6);
        showLocationMap(pos.coords.latitude,pos.coords.longitude);
        hint.textContent='✅ Position ajoutée. Tu peux remplacer les coordonnées par une adresse plus précise.';
      }
    },()=>{hint.textContent='Impossible d’accéder à ta position. Vérifie l’autorisation de localisation dans ton iPhone.'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  });
}
function resetCreateEventForm(){
  $('ename').value='';
  $('eventDate').value='';
  $('place').value='';
  $('eventDescriptionInput').value='';
  if($('eventCoverFileInput')) $('eventCoverFileInput').value='';
  if($('eventCoverFileName')) $('eventCoverFileName').textContent='';
  if($('locationHint')) $('locationHint').textContent='Tu peux saisir une adresse, un lieu ou utiliser ta position.';
  if($('createLocationMap')) $('createLocationMap').classList.add('hidden');
  if($('createLocationMapFrame')) $('createLocationMapFrame').src='about:blank';
  if($('createLocationMapLink')) $('createLocationMapLink').href='#';
  $('eventmsg').textContent='';
}
$('createEventCard')?.addEventListener('toggle',()=>{
  if($('createEventCard').open) resetCreateEventForm();
});
function openEventTool(id){
  const el=$(id);
  if(!el)return;
  ['createEventCard','joinCard','editEventBox','inviteCard'].forEach(other=>{if(other!==id && $(other)){ $(other).open=false; $(other).classList.add('hidden'); }});
  el.classList.remove('hidden');
  el.open=true;
  if(id==='inviteCard') updateInviteUI();
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
['createEventCard','joinCard','editEventBox','inviteCard'].forEach(id=>{const el=$(id);el?.addEventListener('toggle',()=>{if(!el.open)el.classList.add('hidden')});});
$('createEventInlineBtn')?.addEventListener('click',()=>openEventTool('createEventCard'));
$('joinEventInlineBtn')?.addEventListener('click',()=>openEventTool('joinCard'));
$('eventInviteToggle')?.addEventListener('click',()=>openEventTool('inviteCard'));
$('closeInviteBtn')?.addEventListener('click',(ev)=>{
  ev.preventDefault(); ev.stopPropagation();
  const el=$('inviteCard');
  if(el){ el.open=false; el.classList.add('hidden'); }
});
$('eventBtn').addEventListener('click',createEvent);
$('eventCoverFileInput')?.addEventListener('change',()=>{
  const f=$('eventCoverFileInput').files?.[0];
  $('eventCoverFileName').textContent=f?('📎 '+f.name):'';
});
$('editEventCoverFile')?.addEventListener('change',()=>{
  const f=$('editEventCoverFile').files?.[0];
  $('editEventCoverFileName').textContent=f?('📎 '+f.name):'';
});

$('saveEventBtn').addEventListener('click',saveEvent);
$('leaveEventBtn').addEventListener('click',()=>leaveEvent(event?.id));
$('editEventToggle').addEventListener('click',()=>openEventTool('editEventBox'));

$('sendBtn').addEventListener('click',sendMessage);
let lastVoiceTouch=0;
$('voiceBtn').addEventListener('touchstart',()=>{lastVoiceTouch=Date.now()},{passive:true});
$('voiceBtn').addEventListener('click',()=>{if(Date.now()-lastVoiceTouch<700)return;toggleVoiceRecording();});
$('cancelRecordingBtn')?.addEventListener('click',cancelVoiceRecording);
$('pollBtn').addEventListener('click',createPoll);
$('mediaBtn').addEventListener('click',uploadMedia);
$('logoutBtn').addEventListener('click',logout);

// Accès discret au profil : appui long sur la photo de profil
let profileLongPressTimer=null;
let profileLongPressTriggered=false;
const profileTrigger=$('profileAvatar');
if(profileTrigger){
  const openProfileSettings=()=>{
    const card=$('profileSettingsCard');
    if(!card)return;
    card.classList.toggle('profileSettingsVisible');
    card.classList.toggle('profileSettingsOpen');
    if(card.classList.contains('profileSettingsVisible')) card.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const startProfileLongPress=(e)=>{
    profileLongPressTriggered=false;
    clearTimeout(profileLongPressTimer);
    profileLongPressTimer=setTimeout(()=>{
      profileLongPressTriggered=true;
      openProfileSettings();
      if(navigator.vibrate) navigator.vibrate(20);
    },550);
  };
  const cancelProfileLongPress=()=>{clearTimeout(profileLongPressTimer); profileLongPressTimer=null;};
  profileTrigger.addEventListener('pointerdown',startProfileLongPress);
  profileTrigger.addEventListener('pointerup',cancelProfileLongPress);
  profileTrigger.addEventListener('pointercancel',cancelProfileLongPress);
  profileTrigger.addEventListener('pointerleave',cancelProfileLongPress);
  profileTrigger.addEventListener('contextmenu',e=>e.preventDefault());
  profileTrigger.addEventListener('click',e=>{if(profileLongPressTriggered){e.preventDefault();e.stopPropagation();profileLongPressTriggered=false;}});
}

document.querySelectorAll('.avatarChoice').forEach(b=>b.addEventListener('click',()=>{ $('avatarInput').value=''; setAvatarChoice(b.dataset.avatar); document.querySelectorAll('.builderChoice').forEach(x=>x.classList.remove('selected')); $('profileAvatar').innerHTML='<div class="profileAvatar" style="font-size:36px">'+esc(b.dataset.avatar)+'</div>'; }));
document.querySelectorAll('.builderChoice').forEach(b=>b.addEventListener('click',()=>{ $('avatarInput').value=''; document.querySelectorAll('.avatarChoice').forEach(x=>x.classList.remove('selected')); avatarDesign[b.dataset.group]=b.dataset.value; renderCustomAvatar(); $('profileAvatar').innerHTML='<img src="'+customAvatarData()+'" alt="Avatar personnalisé">'; }));
$('avatarInput').addEventListener('change',()=>{if($('avatarInput').files?.length){document.querySelectorAll('.avatarChoice,.builderChoice').forEach(b=>b.classList.remove('selected')); $('profileAvatar').innerHTML='<span>📷</span>'; }});
$('aiAvatarInput').addEventListener('change',async()=>{ try{ const f=$('aiAvatarInput').files?.[0]; if(!f)return; const d=await fileToDataUrl(f); setAiPhotoPreview(d); setAiMsg('Photo prête ✓','ok'); }catch(e){ setAiMsg('Erreur : '+(e.message||String(e)),'err'); } });
$('generateAiAvatarBtn').addEventListener('click',generateAiAvatar);
$('saveProfileBtn').addEventListener('click',saveProfile);
$('copyInviteBtn').addEventListener('click',copyInvite);
$('shareInviteBtn').addEventListener('click',shareInvite);
$('joinBtn').addEventListener('click',()=>joinEvent($('joinCode').value));
$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinEvent($('joinCode').value)});

/* Météo liée à l’événement — Open-Meteo, sans clé API */
const weatherIcons={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'};
const weatherLabels={0:'Ciel dégagé',1:'Peu nuageux',2:'Partiellement nuageux',3:'Couvert',45:'Brouillard',48:'Brouillard givrant',51:'Bruine',53:'Bruine',55:'Forte bruine',61:'Pluie faible',63:'Pluie',65:'Forte pluie',71:'Neige faible',73:'Neige',75:'Forte neige',80:'Averses faibles',81:'Averses',82:'Fortes averses',85:'Averses de neige',86:'Fortes averses de neige',95:'Orage',96:'Orage avec grêle',99:'Orage avec grêle'};
function weatherDateLabel(iso){try{return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}).replace('.','')}catch(e){return iso}}
function extractWeatherCoordinates(place){
  if(!place) return null;
  let s=String(place).trim();
  try{s=decodeURIComponent(s)}catch(e){}
  const valid=(lat,lon)=>{lat=Number(String(lat).replace(',','.'));lon=Number(String(lon).replace(',','.'));return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon,source:'gps'}:null;};
  try{const j=JSON.parse(s);if(j&&typeof j==='object'){const r=valid(j.lat??j.latitude,j.lon??j.lng??j.longitude);if(r)return r;if(Array.isArray(j.coordinates)&&j.coordinates.length>=2){const r2=valid(j.coordinates[1],j.coordinates[0]);if(r2)return r2;}}}catch(e){}
  let m=s.match(/@\s*(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/i);if(m){const r=valid(m[1],m[2]);if(r)return r;}
  m=s.match(/(?:[?&](?:q|query|ll|center)=)(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/i);if(m){const r=valid(m[1],m[2]);if(r)return r;}
  m=s.match(/(?:lat(?:itude)?\s*[:=]\s*)(-?\d+(?:[.,]\d+)?)[^\d-]+(?:lon(?:gitude)?|lng)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i);if(m){const r=valid(m[1],m[2]);if(r)return r;}
  m=s.match(/(?:^|[^\d-])(-?\d{1,3}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)(?:$|[^\d])/);if(m){const r=valid(m[1],m[2]);if(r)return r;}
  m=s.match(/(-?\d+(?:[.,]\d+)?)\s*([NS])[^\d-]+(-?\d+(?:[.,]\d+)?)\s*([EW])/i);if(m){let lat=Number(m[1].replace(',','.')),lon=Number(m[3].replace(',','.'));if(m[2].toUpperCase()==='S')lat=-Math.abs(lat);if(m[4].toUpperCase()==='W')lon=-Math.abs(lon);const r=valid(lat,lon);if(r)return r;}
  m=s.match(/(-?\d+(?:[.,]\d+)?)\s*([EW])[^\d-]+(-?\d+(?:[.,]\d+)?)\s*([NS])/i);if(m){let lon=Number(m[1].replace(',','.')),lat=Number(m[3].replace(',','.'));if(m[2].toUpperCase()==='W')lon=-Math.abs(lon);if(m[4].toUpperCase()==='S')lat=-Math.abs(lat);const r=valid(lat,lon);if(r)return r;}
  m=s.match(/latitude[^0-9-]*(-?\d+(?:[.,]\d+)?).*?(?:longitude|lng)[^0-9-]*(-?\d+(?:[.,]\d+)?)/i);if(m){const r=valid(m[1],m[2]);if(r)return r;}
  return null;
}
async function loadWeather(){
  const root=$('weatherContent');
  if(!root)return;
  if(!event){root.innerHTML='<p class="muted">Sélectionne un événement pour afficher la météo.</p>';return}
  const place=(event.location||'').trim();
  if(!place){root.innerHTML='<p class="muted">Ajoute un lieu à l’événement pour obtenir la météo.</p>';return}
  root.innerHTML='<p class="muted">🌍 Recherche du lieu et des prévisions…</p>';
  try{
    const coords=extractWeatherCoordinates(place);
    let lat,lon,placeLabel=place,admin='';
    if(coords){
      lat=coords.lat;lon=coords.lon;
      // Les coordonnées GPS sont utilisées directement pour les prévisions.
      // On tente seulement d'obtenir un nom lisible, sans rendre la météo dépendante du reverse-geocoding.
      try{
        const rev=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=10&addressdetails=1',{headers:{'Accept':'application/json'}});
        if(rev.ok){const rd=await rev.json(),a=rd.address||{};placeLabel=a.city||a.town||a.village||a.municipality||rd.name||'Position GPS';admin=a.state||a.region||'';}
      }catch(e){}
    }else{
      const geo=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(place)+'&count=1&language=fr&format=json');
      if(!geo.ok)throw new Error('Service météo indisponible');
      const gd=await geo.json(),g=gd.results?.[0];
      if(!g)throw new Error('Lieu introuvable. Vérifie le lieu ou les coordonnées GPS de l’événement.');
      lat=g.latitude;lon=g.longitude;placeLabel=g.name||place;admin=g.admin1||'';
    }
    const rr=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&timezone=auto&current=temperature_2m,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&forecast_days=16');
    if(!rr.ok)throw new Error('Prévisions indisponibles');
    const d=await rr.json(),c=d.current||{},day=d.daily||{},code=c.weather_code??0,targetDate=event.event_date?new Date(event.event_date):null;
    let idx=0;
    if(targetDate&&Array.isArray(day.time)){
      const td=targetDate.toLocaleDateString('en-CA',{timeZone:d.timezone||'UTC'});
      const found=day.time.findIndex(x=>x===td);if(found>=0)idx=found;
    }
    const tmin=day.temperature_2m_min?.[idx],tmax=day.temperature_2m_max?.[idx],pop=day.precipitation_probability_max?.[idx],wmax=day.wind_speed_10m_max?.[idx];
    const eventTxt=targetDate?' pour le '+targetDate.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}):'';
    const days=(day.time||[]).slice(0,7).map((date,i)=>'<div class="weatherDay"><b>'+weatherDateLabel(date)+'</b><span>'+(weatherIcons[day.weather_code?.[i]]||'🌤️')+'</span><span>'+Math.round(day.temperature_2m_max?.[i]??0)+'° / '+Math.round(day.temperature_2m_min?.[i]??0)+'°</span><span>🌧️ '+(day.precipitation_probability_max?.[i]??0)+'%</span></div>').join('');
    const locationLine=coords?'📍 '+placeLabel+(admin?', '+admin:'')+' · GPS '+lat.toFixed(5)+', '+lon.toFixed(5):'📍 '+placeLabel+(admin?', '+admin:'');
    root.innerHTML='<div class="muted">'+locationLine+eventTxt+'</div><div class="weatherNow"><div class="weatherIcon">'+(weatherIcons[code]||'🌤️')+'</div><div><div class="weatherTemp">'+Math.round(c.temperature_2m??tmax??0)+'°C</div><div class="weatherMeta"><span>'+(weatherLabels[code]||'Conditions actuelles')+'</span><span>💨 '+Math.round(c.wind_speed_10m??wmax??0)+' km/h · 🌧️ '+Math.round((c.precipitation??0)*10)/10+' mm</span></div></div></div><div class="weatherHint muted">Prévision pour la date de l’événement : <b>'+Math.round(tmax??0)+'° / '+Math.round(tmin??0)+'°</b> · pluie '+(pop??0)+'% · vent jusqu’à '+Math.round(wmax??0)+' km/h</div><div class="weatherForecast">'+days+'</div>';
  }catch(e){root.innerHTML='<p class="muted">⚠️ '+(e.message||'Impossible de charger la météo.')+'</p>'}
}

/* Appel de groupe — V11 : WebRTC maillé + présence Supabase + reconnexion robuste */
let callChannel=null,callStream=null,callPeers=new Map(),callStreams=new Map(),callActive=false,callMuted=false,callCamera=true,callLayout='auto',callFocusId='',callIceQueue=new Map(),callReconnectTimers=new Map();
function setCallStatus(t){if($('callStatus'))$('callStatus').textContent=t;if($('callOverlayStatus'))$('callOverlayStatus').textContent=t}
function callParticipantIds(){return ['local',...Array.from(callPeers.keys())]}
function displayCallName(id){if(id==='local')return user?.pseudo||user?.name||'Moi';return document.getElementById('call-'+id)?.dataset.name||callStreams.get(id)?.name||'Participant'}
function updateCallCount(){const n=callPeers.size+(callActive?1:0);if($('callCount'))$('callCount').textContent=n+' participant'+(n>1?'s':'');if($('callOverlayStatus')&&callActive)$('callOverlayStatus').textContent='Appel en cours · '+n+' participant'+(n>1?'s':'');updateCallFocusOptions();renderCallStage()}
function addCallTile(id,name,stream,local=false){
 const grid=$('callGrid');if(!grid)return;let tile=document.getElementById('call-'+id);
 if(!tile){tile=document.createElement('div');tile.className='callTile'+(local?' local':'');tile.id='call-'+id;tile.dataset.name=name||'Participant';
  const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=!!local;tile.appendChild(v);
  const lab=document.createElement('span');lab.className='callName';lab.textContent=name||'Participant';tile.appendChild(lab);grid.appendChild(tile);
 }
 tile.dataset.name=name||tile.dataset.name||'Participant';
 if(stream){callStreams.set(id,{stream,name:name||'Participant'});const lab=tile.querySelector('.callName');if(lab)lab.textContent=name||'Participant';const v=tile.querySelector('video');if(v&&v.srcObject!==stream){v.srcObject=stream;v.muted=!!local;v.play().catch(()=>{})}}
 renderCallStage();updateCallFocusOptions();
}
function removeCallTile(id){document.getElementById('call-'+id)?.remove();callStreams.delete(id);if(callFocusId===id)callFocusId='';renderCallStage();updateCallFocusOptions()}
function updateCallFocusOptions(){const sel=$('callFocusSelect');if(!sel)return;const ids=callParticipantIds();const prev=callFocusId;sel.innerHTML='<option value="">⭐ Personne</option>'+ids.map(id=>'<option value="'+id+'">⭐ '+displayCallName(id)+'</option>').join('');if(ids.includes(prev))sel.value=prev}
function renderCallStage(){
 const stage=$('callStage');if(!stage)return;stage.innerHTML='';const ids=callParticipantIds().filter(id=>callStreams.has(id));const count=ids.length;
 ids.forEach(id=>{const info=callStreams.get(id);const tile=document.createElement('div');tile.className='callTile'+(id==='local'?' local':'')+(callFocusId===id?' focused':'');tile.id='call-'+id;tile.dataset.name=info.name||'Participant';const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=id==='local';v.srcObject=info.stream;v.play().catch(()=>{});tile.appendChild(v);const lab=document.createElement('span');lab.className='callName';lab.textContent=info.name||'Participant';tile.appendChild(lab);stage.appendChild(tile)});
 stage.classList.remove('mode-two','mode-grid','mode-spotlight');
 if(callLayout==='spotlight'||callFocusId)stage.classList.add('mode-spotlight');else if(callLayout==='grid'||count>=3)stage.classList.add('mode-grid');else stage.classList.add('mode-two');
}
async function openCallOverlay(){const o=$('callOverlay');if(!o)return;o.classList.add('active');o.setAttribute('aria-hidden','false');renderCallStage();document.querySelectorAll('#callStage video').forEach(v=>v.play().catch(()=>{}));try{if(document.documentElement.requestFullscreen&&!/iPhone|iPad|iPod/i.test(navigator.userAgent))await document.documentElement.requestFullscreen()}catch(e){}}
async function minimizeCallOverlay(){const o=$('callOverlay');if(!o)return;o.classList.remove('active');o.setAttribute('aria-hidden','true');try{if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen()}catch(e){}document.querySelectorAll('#callGrid video').forEach(v=>v.play().catch(()=>{}))}
async function requestCallPiP(){const stage=$('callStage'),video=stage?.querySelector('video');if(!video)return;try{if(document.pictureInPictureEnabled&&video.requestPictureInPicture){await video.requestPictureInPicture();return}}catch(e){console.warn('PiP:',e)}if($('callMsg'))$('callMsg').textContent='La mini-fenêtre n’est pas disponible dans ce navigateur. L’appel reste actif si tu réduis le salon.'}
function queueIce(peerId,candidate){if(!callIceQueue.has(peerId))callIceQueue.set(peerId,[]);callIceQueue.get(peerId).push(candidate)}
async function flushIce(peerId,pc){const q=callIceQueue.get(peerId)||[];callIceQueue.delete(peerId);for(const c of q){try{await pc.addIceCandidate(new RTCIceCandidate(c))}catch(e){console.warn('ICE:',e)}}}
async function closeCallPeer(peerId,remove=true){const pc=callPeers.get(peerId);if(pc){try{pc.onconnectionstatechange=null;pc.close()}catch(e){}callPeers.delete(peerId)}if(remove)removeCallTile(peerId);callReconnectTimers.delete(peerId);}
async function ensureCallPeer(peerId,initiator,force=false){
 if(!callActive||!callStream||!peerId||peerId===user?.id)return null;
 const existing=callPeers.get(peerId);if(existing&&['connected','connecting','new'].includes(existing.connectionState)&&!force)return existing;if(existing)await closeCallPeer(peerId,true);
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]});
 callStream.getTracks().forEach(t=>pc.addTrack(t,callStream));
 pc.onicecandidate=e=>{if(e.candidate)callChannel?.send({type:'broadcast',event:'signal',payload:{kind:'ice',from:user.id,to:peerId,candidate:e.candidate}})};
 pc.ontrack=e=>{const stream=e.streams?.[0];if(stream){addCallTile(peerId,'Participant',stream,false);document.querySelectorAll('#callStage video').forEach(v=>v.play().catch(()=>{}))}};
 pc.onconnectionstatechange=()=>{const st=pc.connectionState;if(st==='connected'){callReconnectTimers.delete(peerId);updateCallCount();return}if(st==='failed'||st==='disconnected'){if(!callReconnectTimers.has(peerId)){const timer=setTimeout(async()=>{callReconnectTimers.delete(peerId);if(!callActive||!callChannel)return;try{await ensureCallPeer(peerId,user.id<peerId,true);await sendCallPresence('reconnect')}catch(e){console.warn('Reconnexion appel:',e)}},2500);callReconnectTimers.set(peerId,timer)} }};
 callPeers.set(peerId,pc);updateCallCount();
 if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await callChannel?.send({type:'broadcast',event:'signal',payload:{kind:'offer',from:user.id,to:peerId,description:pc.localDescription}})}
 return pc;
}
async function sendCallPresence(kind='join'){if(!callChannel||!user)return;try{await callChannel.send({type:'broadcast',event:'signal',payload:{kind,from:user.id,to:'*',name:user.pseudo||user.name||'Participant'}})}catch(e){}}
async function handleCallSignal(p){
 if(!p||!callActive||(p.to!=='*'&&p.to!==user?.id)||p.from===user?.id)return;
 try{
  if(p.kind==='join'||p.kind==='reconnect'){
   const initiator=user.id<p.from; await ensureCallPeer(p.from,initiator,true); return;
  }
  if(p.kind==='offer'){
   const pc=await ensureCallPeer(p.from,false);if(!pc)return;await pc.setRemoteDescription(new RTCSessionDescription(p.description));await flushIce(p.from,pc);const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await callChannel?.send({type:'broadcast',event:'signal',payload:{kind:'answer',from:user.id,to:p.from,description:pc.localDescription}});return;
  }
  if(p.kind==='answer'){const pc=callPeers.get(p.from);if(pc){await pc.setRemoteDescription(new RTCSessionDescription(p.description));await flushIce(p.from,pc)}return}
  if(p.kind==='ice'){const pc=callPeers.get(p.from);if(pc&&pc.remoteDescription?.type)try{await pc.addIceCandidate(new RTCIceCandidate(p.candidate))}catch(e){console.warn('ICE:',e)}else queueIce(p.from,p.candidate);return}
  if(p.kind==='leave'){await closeCallPeer(p.from,true);updateCallCount()}
 }catch(e){console.warn('Signalisation appel:',e)}
}
async function setupCallChannel(){
 callChannel=sb.channel('event-call-'+event.id,{config:{broadcast:{self:false},presence:{key:user.id}}});
 callChannel.on('broadcast',{event:'signal'},({payload})=>handleCallSignal(payload));
 callChannel.on('presence',{event:'sync'},async()=>{if(!callActive)return;const state=callChannel.presenceState();for(const key of Object.keys(state)){if(key===user.id)continue;const meta=state[key]?.[0]||{};const peerId=meta.user_id||key;const initiator=user.id<peerId;await ensureCallPeer(peerId,initiator,true)}});
 callChannel.on('presence',{event:'join'},async({key,newPresences})=>{if(!callActive||key===user.id)return;const peerId=newPresences?.[0]?.user_id||key;await ensureCallPeer(peerId,user.id<peerId,true)});
 callChannel.on('presence',{event:'leave'},async({key})=>{if(key!==user.id){await closeCallPeer(key,true);updateCallCount()}});
 await new Promise((resolve,reject)=>callChannel.subscribe(async st=>{if(st==='SUBSCRIBED'){try{await callChannel.track({user_id:user.id,name:user.pseudo||user.name||'Participant'});resolve()}catch(e){reject(e)}}else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED')reject(new Error('Impossible d’ouvrir le salon.'))}));
}
async function announceGroupCall(){if(!event||!user||!sb)return;try{const content='[[MYEVENT_GROUP_CALL]]'+JSON.stringify({eventName:event.name||'Événement'});const r=await sb.from('messages').insert({event_id:event.id,user_id:user.id,content}).select('id').single();if(!r.error)rememberLocalCreated('messages',r.data?.id);await loadMessages()}catch(e){console.warn('Annonce appel:',e.message||e)}}
async function startGroupCall(){
 if(callActive){await openCallOverlay();return}
 if(!event||!user||!sb){if($('callMsg'))$('callMsg').textContent='Sélectionne un événement et connecte-toi.';return}
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('La caméra et le micro ne sont pas disponibles sur cet appareil.');
  callStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  callActive=true;callMuted=false;callCamera=true;callLayout='auto';callFocusId='';callIceQueue.clear();
  addCallTile('local',user.pseudo||user.name||'Moi',callStream,true);
  await setupCallChannel();
  await sendCallPresence('join');
  setCallStatus('Appel en cours');$('startCallBtn')?.classList.add('hidden');$('joinCallBtn')?.classList.add('hidden');$('openCallBtn')?.classList.remove('hidden');$('muteCallBtn')?.classList.remove('hidden');$('cameraCallBtn')?.classList.remove('hidden');$('leaveCallBtn')?.classList.remove('hidden');if($('callMsg'))$('callMsg').textContent='Le salon est ouvert. Tu peux le réduire sans quitter l’appel.';updateCallCount();await announceGroupCall();await openCallOverlay();
 }catch(e){callActive=false;try{if(callChannel)await sb.removeChannel(callChannel)}catch(_){}callChannel=null;callStream?.getTracks().forEach(t=>t.stop());callStream=null;if($('callMsg'))$('callMsg').textContent='⚠️ '+(e.message||'Impossible de démarrer l’appel.')}}
async function stopGroupCall(){
 minimizeCallOverlay();
 if(callChannel){try{await callChannel.send({type:'broadcast',event:'signal',payload:{kind:'leave',from:user?.id,to:'*'}})}catch(e){}try{await callChannel.untrack()}catch(e){}try{await sb.removeChannel(callChannel)}catch(e){}callChannel=null}
 callReconnectTimers.forEach(t=>clearTimeout(t));callReconnectTimers.clear();callPeers.forEach(pc=>{try{pc.close()}catch(e){}});callPeers.clear();callStreams.clear();callIceQueue.clear();callStream?.getTracks().forEach(t=>t.stop());callStream=null;callActive=false;callFocusId='';document.querySelectorAll('#callGrid .callTile').forEach(x=>x.remove());setCallStatus('Le salon est fermé.');$('startCallBtn')?.classList.remove('hidden');$('joinCallBtn')?.classList.remove('hidden');$('openCallBtn')?.classList.add('hidden');$('muteCallBtn')?.classList.add('hidden');$('cameraCallBtn')?.classList.add('hidden');$('leaveCallBtn')?.classList.add('hidden');updateCallCount()}
function toggleCallMute(){callMuted=!callMuted;callStream?.getAudioTracks().forEach(t=>t.enabled=!callMuted);const txt=callMuted?'🔇':'🎙️';if($('muteCallBtn'))$('muteCallBtn').textContent=txt;if($('overlayMuteBtn'))$('overlayMuteBtn').textContent=txt}
function toggleCallCamera(){callCamera=!callCamera;callStream?.getVideoTracks().forEach(t=>t.enabled=callCamera);const txt=callCamera?'📷':'🚫';if($('cameraCallBtn'))$('cameraCallBtn').textContent=txt;if($('overlayCameraBtn'))$('overlayCameraBtn').textContent=txt}
function setCallLayoutMode(v){callLayout=v||'auto';if(callLayout!=='spotlight')callFocusId='';renderCallStage()}
function setCallFocus(v){callFocusId=v||'';if(callFocusId)callLayout='spotlight';renderCallStage()}
$('startCallBtn')?.addEventListener('click',startGroupCall);$('joinCallBtn')?.addEventListener('click',startGroupCall);$('openCallBtn')?.addEventListener('click',openCallOverlay);$('leaveCallBtn')?.addEventListener('click',stopGroupCall);$('muteCallBtn')?.addEventListener('click',toggleCallMute);$('cameraCallBtn')?.addEventListener('click',toggleCallCamera);$('minimizeCallBtn')?.addEventListener('click',minimizeCallOverlay);$('overlayLeaveBtn')?.addEventListener('click',stopGroupCall);$('overlayMuteBtn')?.addEventListener('click',toggleCallMute);$('overlayCameraBtn')?.addEventListener('click',toggleCallCamera);$('pipCallBtn')?.addEventListener('click',requestCallPiP);$('callLayoutSelect')?.addEventListener('change',e=>setCallLayoutMode(e.target.value));$('callFocusSelect')?.addEventListener('change',e=>setCallFocus(e.target.value));
document.addEventListener('click',e=>{const tile=e.target.closest('#callStage .callTile');if(!tile||!callActive)return;const id=tile.id.replace('call-','');if(callStreams.has(id)){callFocusId=id;callLayout='spotlight';if($('callFocusSelect'))$('callFocusSelect').value=id;renderCallStage();}},true);
/* Réorganisation des cartes par maintien sur ⠿ puis glisser-déposer */
(function initCardReorder(){
  const cards=()=>Array.from(document.querySelectorAll('.reorderableCard'));
  const keyBase='myevent_card_order_v2_';
  const key=()=>keyBase+(user?.id||'guest');
  let dragCard=null, dragTimer=null, dragging=false;
  function saveOrder(){
    try{localStorage.setItem(key(), JSON.stringify(cards().map(c=>c.id).filter(Boolean)));}catch(e){}
  }
  function restoreOrder(){
    try{
      const ids=JSON.parse(localStorage.getItem(key())||'[]');
      if(!Array.isArray(ids)||!ids.length)return;
      const current=new Map(cards().map(c=>[c.id,c]));
      const ordered=ids.map(id=>current.get(id)).filter(Boolean);
      if(!ordered.length)return;
      const parent=ordered[0].parentElement;
      let anchor=cards().find(c=>!ordered.includes(c));
      // Rebuild only the movable-card sequence; fixed elements keep their relative position.
      ordered.forEach(c=>{
        if(anchor && anchor.parentElement===parent) parent.insertBefore(c,anchor);
        else parent.appendChild(c);
      });
    }catch(e){}
  }
  function finish(){
    clearTimeout(dragTimer); dragTimer=null;
    if(!dragging){dragCard=null;return;}
    dragging=false;
    if(dragCard){dragCard.classList.remove('dragging','dropTarget');saveOrder();}
    document.querySelectorAll('.reorderableCard.dropTarget').forEach(c=>c.classList.remove('dropTarget'));
    dragCard=null;
  }
  function move(e){
    if(!dragging||!dragCard)return;
    const candidates=cards().filter(c=>c!==dragCard && !c.classList.contains('hidden'));
    let target=null, before=true, best=Infinity;
    for(const c of candidates){
      const r=c.getBoundingClientRect();
      const d=Math.abs(e.clientY-(r.top+r.height/2));
      if(d<best){best=d;target=c;before=e.clientY<r.top+r.height/2;}
    }
    document.querySelectorAll('.reorderableCard.dropTarget').forEach(c=>c.classList.remove('dropTarget'));
    if(target){target.classList.add('dropTarget'); if(before)target.parentElement.insertBefore(dragCard,target); else target.parentElement.insertBefore(dragCard,target.nextSibling);}
  }
  document.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.dragHandle');
    if(!handle)return;
    const card=handle.closest('.reorderableCard');
    if(!card)return;
    e.preventDefault();
    dragCard=card;
    clearTimeout(dragTimer);
    dragTimer=setTimeout(()=>{
      dragging=true;card.classList.add('dragging');
      if(navigator.vibrate)navigator.vibrate(25);
    },320);
  },{passive:false});
  document.addEventListener('pointermove',e=>{if(dragging){e.preventDefault();move(e);}}, {passive:false});
  document.addEventListener('pointerup',finish);
  document.addEventListener('pointercancel',finish);
  document.addEventListener('click',e=>{if(e.target.closest('.dragHandle')){e.preventDefault();e.stopPropagation();}},true);
  window.restoreMyEventCardOrder=restoreOrder;
  restoreOrder();
})();

document.addEventListener('visibilitychange',()=>{if(callActive){callStream?.getTracks().forEach(t=>{t.enabled=true});if(document.visibilityState==='visible')updateCallCount()}});
