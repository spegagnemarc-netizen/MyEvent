/* ===== original inline script 29 ===== */
(function(){
  const $=id=>document.getElementById(id);
  let map=null, meMarker=null, leisureLayer=null, friendLayer=null, eventLayer=null;

  function avatarSrc(){
    const img=$('profileAvatar')?.querySelector?.('img');
    return img?.src||'';
  }
  function avatarIcon(src,emoji){
    const html=src
      ? '<div class="myeventMapAvatarMarker"><img src="'+String(src).replace(/"/g,'&quot;')+'" alt=""></div>'
      : '<div class="myeventMapAvatarMarker"><span>'+emoji+'</span></div>';
    return L.divIcon({className:'',html,iconSize:[46,46],iconAnchor:[23,23]});
  }
  function leisureIcon(emoji){
    return L.divIcon({className:'',html:'<div class="myeventLeisureMarker">'+emoji+'</div>',iconSize:[38,38],iconAnchor:[19,19]});
  }
  function ensureMap(){
    const node=$('myeventNearbyMap');
    if(!node||!window.L)return;
    if(!map){
      map=L.map(node,{zoomControl:true,attributionControl:true});
      window.myeventNearbyLeafletMap=map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'&copy; OpenStreetMap'
      }).addTo(map);
      leisureLayer=L.layerGroup().addTo(map);
      friendLayer=L.layerGroup().addTo(map);
      eventLayer=L.layerGroup().addTo(map);
    }
    setTimeout(()=>map.invalidateSize(),100);
    return map;
  }
  function position(){
    try{return JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null')}catch(e){return null}
  }
  function openFullMap(){
    const p=$('myeventNearbyPanel'); if(!p)return;
    p.classList.add('open');p.setAttribute('aria-hidden','false');
    const m=ensureMap();
    const pos=position();
    if(!m||!pos?.lat||!pos?.lon){
      navigator.geolocation?.getCurrentPosition(showPosition,()=>{});
    }else showPosition({coords:{latitude:+pos.lat,longitude:+pos.lon}});
  }
  function showPosition(pos){
    const lat=+pos.coords.latitude,lon=+pos.coords.longitude;
    try{localStorage.setItem('myevent_social_last_position_v1',JSON.stringify({lat,lon,updatedAt:Date.now()}))}catch(e){}
    const m=ensureMap(); if(!m)return;
    m.setView([lat,lon],14);
    if(meMarker)m.removeLayer(meMarker);
    meMarker=L.marker([lat,lon],{icon:avatarIcon(avatarSrc(),'👤'),zIndexOffset:1000}).addTo(m).bindPopup('<b>📍 Ma position</b>');
    loadNearbyLeisure(lat,lon);
    loadDemoFriends(lat,lon);
    setTimeout(()=>m.invalidateSize(),120);
  }
  async function loadNearbyLeisure(lat,lon){
    if(!leisureLayer)return;
    leisureLayer.clearLayers();
    // OpenStreetMap/Overpass : recherche légère de points d'intérêt autour de l'utilisateur.
    const q='[out:json][timeout:8];(nwr(around:2500,'+lat+','+lon+',leisure~"sports_centre|stadium|fitness_centre|park|pitch|golf_course");nwr(around:2500,'+lat+','+lon+',amenity~"restaurant|cafe|cinema|bar"););out center tags 40;';
    try{
      const r=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q));
      if(!r.ok)throw Error();
      const d=await r.json();
      (d.elements||[]).forEach(x=>{
        const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
        if(!p[0]||!p[1])return;
        const tags=x.tags||{}, name=tags.name||'Lieu à proximité';
        let emoji='🎯',type='activity';
        if(tags.amenity==='restaurant'||tags.amenity==='cafe')emoji='🍽️',type='restaurant';
        else if(tags.leisure==='park')emoji='🌳',type='activity';
        else if(tags.leisure==='golf_course')emoji='⛳',type='sport';
        else if(tags.leisure)emoji='⚽',type='sport';
        const mk=L.marker(p,{icon:leisureIcon(emoji)}).bindPopup('<b>'+String(name).replace(/</g,'&lt;')+'</b><br><span>📍 À proximité</span>');
        mk.__nearbyType=type;mk.addTo(leisureLayer);
      });
    }catch(e){}
  }
  function loadDemoFriends(lat,lon){
    if(!friendLayer)return;
    friendLayer.clearLayers();
    // En attendant la connexion Supabase des positions d'amis, on n'affiche pas de fausses positions.
    // La couche est prête à recevoir les vrais amis partagés.
  }
  function filter(kind){
    document.querySelectorAll('[data-nearby-filter]').forEach(b=>b.classList.toggle('active',b.dataset.nearbyFilter===kind));
    if(!map)return;
    [leisureLayer,friendLayer,eventLayer].forEach(layer=>{
      if(layer)layer.eachLayer(m=>{
        const type=m.__nearbyType||'friends';
        const visible=kind==='all'||(kind==='friends'&&type==='friends')||type===kind|| (kind==='events'&&type==='event');
        if(visible)m.addTo(layer);else layer.removeLayer(m);
      });
    });
  }
  function close(){
    const p=$('myeventNearbyPanel'); if(!p)return;
    p.classList.remove('open');p.setAttribute('aria-hidden','true');
  }

  function init(){
    // Remplace l'ancien comportement : À proximité ouvre uniquement le plein écran.
    document.querySelectorAll('#socialHome .socialStory').forEach(x=>{
      if(x.textContent.trim()==='📍À proximité' || x.textContent.trim()==='À proximité'){
        x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openFullMap();});
      }
    });
    // Le bouton séparé éventuel est neutralisé visuellement et fonctionnellement.
    const old=$('socialNearbyShareBtn'); if(old)old.style.display='none';
    $('closeNearbyPanelBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();close();});
    $('myeventNearbyPanel')?.addEventListener('click',e=>{if(e.target===$('myeventNearbyPanel'))close();});
    document.querySelectorAll('[data-nearby-filter]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();filter(b.dataset.nearbyFilter)}));
    $('myeventNearbyLocateBtn')?.addEventListener('click',()=>navigator.geolocation?.getCurrentPosition(showPosition,()=>{}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 30 ===== */
(function(){
  function p(){return document.getElementById('myeventNearbyPanel')}
  function close(){
    const x=p(); if(!x)return;
    x.classList.remove('open');
    x.setAttribute('aria-hidden','true');
    x.style.display='none';
    document.body.style.overflow='';
  }
  function open(){
    const x=p(); if(!x)return;
    x.style.display='flex';
    x.classList.add('open');
    x.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    setTimeout(function(){
      if(window.L){
        const map=x.querySelector('#myeventNearbyMap');
        if(map && map._leaflet_id && window.dispatchEvent)window.dispatchEvent(new Event('resize'));
      }
    },100);
  }

  function init(){
    // Toujours démarrer sur l'accueil, jamais sur la carte.
    close();

    const closeBtn=document.getElementById('closeNearbyPanelBtn');
    if(closeBtn){
      closeBtn.addEventListener('click',function(e){
        e.preventDefault();e.stopImmediatePropagation();close();
      },true);
    }

    const panel=p();
    if(panel){
      panel.addEventListener('click',function(e){
        if(e.target===panel){e.preventDefault();e.stopPropagation();close();}
      },true);
    }

    // Remplace les anciennes ouvertures de la case À proximité par une seule
    // ouverture contrôlée du plein écran.
    document.querySelectorAll('#socialHome .socialStory').forEach(function(x){
      const label=x.textContent.replace(/\s+/g,' ').trim();
      if(label==='À proximité'){
        const clone=x.cloneNode(true);
        x.replaceWith(clone);
        clone.addEventListener('click',function(e){
          e.preventDefault();e.stopImmediatePropagation();open();
        },true);
      }
    });

    // Le bouton météo de la sixième case reste indépendant.
    const weather=document.querySelector('#socialHome .socialStory.weatherShortcut');
    if(weather){
      const clone=weather.cloneNode(true);
      weather.replaceWith(clone);
      clone.addEventListener('click',function(e){
        e.preventDefault();e.stopImmediatePropagation();
        const w=document.getElementById('myeventPersonalWeatherPanel');
        if(w){
          w.classList.add('open');
          w.setAttribute('aria-hidden','false');
        }
      },true);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();

  // Safari/iOS peut restaurer une page avec son état visuel précédent.
  window.addEventListener('pageshow',function(){close()});
})();

/* ===== original inline script 31 ===== */
(function(){
  function neutralize(root){
    if(!root)return;
    root.querySelectorAll('button').forEach(function(b){
      const txt=(b.textContent||'').trim().toLowerCase();
      // Keep only the main shutter visually distinct; all utility buttons are neutral.
      if(!/^(📷|photo|prendre|capturer)$/i.test(txt)){
        b.style.background='#11161b';
        b.style.borderColor='#3a444d';
        b.style.color='#eef2f5';
        b.style.boxShadow='none';
      }
    });
  }
  function init(){
    neutralize(document.getElementById('myeventCameraModal'));
    neutralize(document.getElementById('myeventNearbyPanel'));
    neutralize(document.getElementById('myeventPersonalWeatherPanel'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 32 ===== */
(function(){
  const $=id=>document.getElementById(id);
  const LEISURE='myevent_nearby_show_leisure_v1';
  const SHARE='myevent_social_location_share_v1';
  const MAP='myevent_nearby_map_type_v1';

  function setToggle(id,key,def){
    const x=$(id); if(!x)return;
    const saved=localStorage.getItem(key);
    x.checked=saved===null?def:saved==='1';
  }
  function saveToggle(id,key){
    const x=$(id); if(x)localStorage.setItem(key,x.checked?'1':'0');
  }
  function openSettings(){
    const x=$('myeventNearbySettings'); if(!x)return;
    setToggle('nearbyShowLeisureToggle',LEISURE,true);
    setToggle('nearbySharePositionToggle',SHARE,false);
    x.classList.add('open');x.setAttribute('aria-hidden','false');
  }
  function closeSettings(){
    const x=$('myeventNearbySettings'); if(!x)return;
    x.classList.remove('open');x.setAttribute('aria-hidden','true');
  }
  function init(){
    $('openNearbySettingsBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openSettings()});
    $('closeNearbySettingsBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeSettings()});
    $('myeventNearbySettings')?.addEventListener('click',e=>{if(e.target===$('myeventNearbySettings'))closeSettings()});

    const leisure=$('nearbyShowLeisureToggle');
    leisure?.addEventListener('change',()=>{
      saveToggle('nearbyShowLeisureToggle',LEISURE);
      // Le chargement réel des loisirs est piloté par la carte; rechargement au prochain affichage.
      if(window.myeventReloadNearbyLeisure)window.myeventReloadNearbyLeisure();
    });

    const share=$('nearbySharePositionToggle');
    share?.addEventListener('change',()=>{
      saveToggle('nearbySharePositionToggle',SHARE);
      const legacy=$('myeventNearbyShareToggle');
      if(legacy)legacy.checked=share.checked;
      if(share.checked && navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos=>{
          try{localStorage.setItem('myevent_social_last_position_v1',JSON.stringify({lat:pos.coords.latitude,lon:pos.coords.longitude,updatedAt:Date.now()}))}catch(e){}
          if(window.myeventShowNearbyPosition)window.myeventShowNearbyPosition(pos);
        },()=>{});
      }
    });

    $('openNearbyMapTypeBtn')?.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const x=$('nearbyMapTypeChoices'); if(x)x.classList.toggle('open');
    });

    document.querySelectorAll('[data-map-type]').forEach(b=>{
      b.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        const type=b.dataset.mapType;
        localStorage.setItem(MAP,type);
        document.querySelectorAll('[data-map-type]').forEach(x=>x.classList.toggle('active',x.dataset.mapType===type));
        if(window.myeventSetNearbyMapType)window.myeventSetNearbyMapType(type);
        const choices=$('nearbyMapTypeChoices'); if(choices)choices.classList.remove('open');
      });
    });

    const savedMap=localStorage.getItem(MAP)||'default';
    document.querySelectorAll('[data-map-type]').forEach(x=>x.classList.toggle('active',x.dataset.mapType===savedMap));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 34 ===== */
(function(){
  function init(){
    const btn=document.getElementById('myeventMapSettingsFloating');
    const settings=document.getElementById('myeventNearbySettings');
    if(btn&&settings){
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        settings.classList.add('open');
        settings.setAttribute('aria-hidden','false');
      },true);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 37 ===== */
(function(){
  const $=id=>document.getElementById(id);
  let toastTimer=null;

  const messages={
    all:'✨ Affichage de tous les éléments autour de toi.',
    friends:'👥 Amis : les amis ayant activé le partage apparaîtront sur la carte.',
    sport:'⚽ Sport : recherche des activités sportives autour de toi.',
    restaurant:'🍽️ Restaurants : recherche des restaurants et cafés autour de toi.',
    activity:'🎯 Loisirs : recherche des loisirs et activités autour de toi.',
    events:'🎉 Événements : les événements proches apparaîtront ici.'
  };

  function toast(txt){
    const t=$('myeventNearbyToast'); if(!t)return;
    clearTimeout(toastTimer);
    t.textContent=txt;
    t.classList.add('show');
    toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
  }

  function setActive(btn){
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.classList.toggle('active',b===btn);
    });
  }

  function getPos(){
    try{return JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null')}catch(e){return null}
  }

  // On donne aux boutons un comportement direct, indépendant des anciens
  // listeners des versions précédentes.
  function activate(btn){
    if(btn.__myevent72)return;
    btn.__myevent72=true;
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      setActive(btn);
      const type=btn.dataset.nearbyFilter||'all';
      toast(messages[type]||'Filtre sélectionné.');

      // Si le bouton correspond à une catégorie de lieux, on demande au
      // moteur de recherche existant de rafraîchir la carte.
      const pos=getPos();
      if(pos && (type==='sport'||type==='restaurant'||type==='activity')){
        if(window.myeventReloadNearbyCategory){
          window.myeventReloadNearbyCategory(type,+pos.lat,+pos.lon);
        }
      }
    },true);
  }

  function init(){
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(activate);

    // Empêche les contrôles Leaflet ou la carte de manger les touch events.
    const tools=$('myeventNearbyMapTools');
    if(tools){
      tools.style.pointerEvents='auto';
      tools.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 38 ===== */
(function(){
  let layer=null;
  const esc=x=>String(x||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function map(){
    return window.myeventNearbyLeafletMap||null;
  }
  function icon(type){
    const emoji=type==='sport'?'⚽':type==='restaurant'?'🍽️':'🎯';
    return L.divIcon({className:'',html:'<div class="myeventLeisureMarker">'+emoji+'</div>',iconSize:[38,38],iconAnchor:[19,19]});
  }
  async function load(type,lat,lon){
    const m=map(); if(!m||!window.L)return;
    if(!layer)layer=L.layerGroup().addTo(m); else layer.clearLayers();
    let q='';
    if(type==='sport'){
      q='[out:json][timeout:8];nwr(around:3000,'+lat+','+lon+',leisure~"sports_centre|stadium|fitness_centre|pitch|golf_course");out center tags 50;';
    }else if(type==='restaurant'){
      q='[out:json][timeout:8];nwr(around:3000,'+lat+','+lon+',amenity~"restaurant|cafe");out center tags 50;';
    }else{
      q='[out:json][timeout:8];nwr(around:3000,'+lat+','+lon+',leisure~"park|playground|water_park|bowling_alley|miniature_golf");out center tags 50;';
    }
    try{
      const r=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q));
      if(!r.ok)throw Error();
      const d=await r.json();
      let count=0;
      (d.elements||[]).forEach(x=>{
        const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
        if(!p[0]||!p[1])return;
        const name=x.tags?.name||'Lieu à proximité';
        L.marker(p,{icon:icon(type)}).bindPopup('<b>'+esc(name)+'</b><br><span>📍 À proximité</span>').addTo(layer);
        count++;
      });
      const t=document.getElementById('myeventNearbyToast');
      if(t){
        t.textContent=count?('✓ '+count+' lieu'+(count>1?'x':'')+' trouvé'+(count>1?'s':'')+'.'): 'Aucun lieu trouvé dans ce rayon.';
        t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200);
      }
    }catch(e){}
  }
  window.myeventReloadNearbyCategory=load;
})();

/* ===== original inline script 39 ===== */
(function(){
  let cityLayer=null, interestLayer=null, loadedKey='';
  const esc=x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function getMap(){return window.myeventNearbyLeafletMap||null}
  function pos(){
    try{return JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null')}catch(e){return null}
  }
  function cityIcon(name){
    return L.divIcon({className:'myeventCityMarker',html:'<div class="myeventCityLabel"><span class="dot"></span><span class="name">'+esc(name)+'</span></div>',iconSize:null,iconAnchor:[5,6]});
  }
  function interestIcon(name,emoji,purple){
    return L.divIcon({className:'myeventInterestMarker',html:'<div class="myeventInterestLabel '+(purple?'purple':'')+'"><span class="pin">'+emoji+'</span><span class="name">'+esc(name)+'</span></div>',iconSize:null,iconAnchor:[14,14]});
  }
  async function loadContent(lat,lon){
    const m=getMap(); if(!m||!window.L)return;
    const key=lat.toFixed(3)+','+lon.toFixed(3);
    if(loadedKey===key)return;
    loadedKey=key;
    cityLayer?.clearLayers(); interestLayer?.clearLayers();
    if(!cityLayer)cityLayer=L.layerGroup().addTo(m);
    if(!interestLayer)interestLayer=L.layerGroup().addTo(m);
    window.myeventNearbyCityLayer=cityLayer;
    window.myeventNearbyInterestLayer=interestLayer;

    const cityQ='[out:json][timeout:10];nwr(around:45000,'+lat+','+lon+')[place~"city|town|village"];out center tags 80;';
    const poiQ='[out:json][timeout:12];(nwr(around:12000,'+lat+','+lon+')[tourism~"attraction|viewpoint|museum|zoo|theme_park|aquarium"];nwr(around:12000,'+lat+','+lon+')[leisure~"park|golf_course|sports_centre|stadium"];nwr(around:12000,'+lat+','+lon+')[amenity~"restaurant|cafe|cinema"];);out center tags 80;';

    try{
      const [cr,pr]=await Promise.all([
        fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(cityQ)),
        fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(poiQ))
      ]);
      if(cr.ok){
        const d=await cr.json();
        const seen=new Set();
        (d.elements||[]).forEach(x=>{
          const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
          const name=x.tags?.name;
          if(!p[0]||!p[1]||!name||seen.has(name))return;
          seen.add(name);
          L.marker(p,{icon:cityIcon(name),interactive:false,zIndexOffset:-100}).addTo(cityLayer);
        });
      }
      if(pr.ok){
        const d=await pr.json();
        const seen=new Set();
        (d.elements||[]).forEach(x=>{
          const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
          const t=x.tags||{},name=t.name;
          if(!p[0]||!p[1]||!name||seen.has(name))return;
          seen.add(name);
          let emoji='📍',purple=false,type='activity';
          if(t.amenity==='restaurant')emoji='🍽️',type='restaurant';
          else if(t.amenity==='cafe')emoji='☕',type='restaurant';
          else if(t.amenity==='cinema')emoji='🎬',type='activity';
          else if(t.leisure==='golf_course')emoji='⛳',type='sport';
          else if(t.leisure==='sports_centre'||t.leisure==='stadium')emoji='⚽',type='sport';
          else if(t.leisure==='park')emoji='🌳',type='activity';
          else if(t.tourism==='viewpoint')emoji='👀',purple=true,type='activity';
          else if(t.tourism==='museum')emoji='🏛️',purple=true,type='activity';
          else if(t.tourism)emoji='🎯',purple=true,type='activity';
          const mk=L.marker(p,{icon:interestIcon(name,emoji,purple)});
          mk.__nearbyType=type;
          mk.bindPopup('<b>'+esc(name)+'</b><br><span>📍 Point intéressant à proximité</span>');
          mk.addTo(interestLayer);
        });
      }
    }catch(e){}
  }

  function refresh(){
    const p=pos(); if(p?.lat&&p?.lon)loadContent(+p.lat,+p.lon);
  }
  window.myeventLoadNearbyMapContent=loadContent;

  function init(){
    let n=0;
    const timer=setInterval(()=>{
      n++;
      const m=getMap();
      if(m){
        clearInterval(timer);
        refresh();
        m.on('moveend',()=>{const c=m.getCenter(); if(Math.abs(c.lat-(pos()?.lat||c.lat))<0.5){}});
      }
      if(n>100)clearInterval(timer);
    },150);

    // Lors d'un clic sur un filtre, garder les villes visibles et adapter
    // les points intéressants à la catégorie choisie.
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.addEventListener('click',()=>{
        const kind=b.dataset.nearbyFilter;
        if(!interestLayer)return;
        interestLayer.eachLayer(m=>{
          const type=m.__nearbyType||'activity';
          const show=kind==='all'||(kind==='activity'&&type==='activity')||type===kind;
          if(show)m.addTo(interestLayer);else interestLayer.removeLayer(m);
        });
      },false);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 40 ===== */
(function(){
  const FILTER_KEY='myevent_nearby_filter_v2';
  const MAP_KEY='myevent_nearby_map_type_v1';
  const LEISURE_KEY='myevent_nearby_show_leisure_v1';
  const SHARE_KEY='myevent_social_location_share_v1';

  function getFilter(){
    try{return localStorage.getItem(FILTER_KEY)||'all'}catch(e){return'all'}
  }
  function saveFilter(v){
    try{localStorage.setItem(FILTER_KEY,v)}catch(e){}
  }

  function setFilterButton(kind){
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.classList.toggle('active',b.dataset.nearbyFilter===kind);
    });
  }

  function applyFilter(kind){
    saveFilter(kind);
    setFilterButton(kind);

    // Reuse the active V54.65 layer references when available.
    const layers=window.myeventNearbyLayers;
    if(layers){
      [layers.leisure,layers.friends,layers.events].forEach(layer=>{
        if(!layer)return;
        layer.eachLayer(m=>{
          const type=m.__nearbyType||'friends';
          const visible=kind==='all'
            ||(kind==='friends'&&type==='friends')
            ||(kind==='events'&&type==='event')
            ||type===kind
            ||(kind==='activity'&&type==='activity');
          if(visible)m.addTo(layer);else layer.removeLayer(m);
        });
      });
    }

    // Also filter the V54.73 real POI layer if it exists.
    if(window.myeventNearbyInterestLayer){
      window.myeventNearbyInterestLayer.eachLayer(m=>{
        const type=m.__nearbyType||'activity';
        const visible=kind==='all'||(kind==='activity'&&type==='activity')||type===kind;
        if(visible)m.addTo(window.myeventNearbyInterestLayer);
        else window.myeventNearbyInterestLayer.removeLayer(m);
      });
    }
  }

  function applySavedMapType(){
    const type=localStorage.getItem(MAP_KEY)||'default';
    document.querySelectorAll('#nearbyMapTypeChoices [data-map-type]').forEach(b=>{
      b.classList.toggle('active',b.dataset.mapType===type);
    });
    let tries=0;
    const run=()=>{
      tries++;
      if(typeof window.myeventSetNearbyMapType==='function' && window.myeventNearbyLeafletMap){
        window.myeventSetNearbyMapType(type);
        return;
      }
      if(tries<30)setTimeout(run,100);
    };
    run();
  }

  function syncSavedSettings(){
    const leisure=document.getElementById('nearbyShowLeisureToggle');
    if(leisure)leisure.checked=(localStorage.getItem(LEISURE_KEY)!=='0');

    const share=document.getElementById('nearbySharePositionToggle');
    if(share)share.checked=(localStorage.getItem(SHARE_KEY)==='1');

    setFilterButton(getFilter());
  }

  function init(){
    syncSavedSettings();

    // Capture the filter choice once and persist it.
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.addEventListener('click',function(){
        applyFilter(b.dataset.nearbyFilter||'all');
      },true);
    });

    // Apply saved state when the map panel opens.
    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      const obs=new MutationObserver(()=>{
        if(panel.classList.contains('open')){
          setTimeout(()=>{
            syncSavedSettings();
            applySavedMapType();
            const p=(()=>{
              try{return JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null')}catch(e){return null}
            })();
            if(p?.lat&&p?.lon && typeof window.myeventLoadNearbyMapContent==='function'){
              window.myeventLoadNearbyMapContent(+p.lat,+p.lon);
            }
          },180);
        }
      });
      obs.observe(panel,{attributes:true,attributeFilter:['class']});
    }

    // If the user changes map type from the settings sheet, keep it across
    // reloads/reconnections and immediately update the visible map.
    document.querySelectorAll('#nearbyMapTypeChoices [data-map-type]').forEach(b=>{
      b.addEventListener('click',function(){
        try{localStorage.setItem(MAP_KEY,b.dataset.mapType||'default')}catch(e){}
      },true);
    });

    setTimeout(applySavedMapType,350);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 41 ===== */
(function(){
  const KEY='myevent_nearby_filter_v2';
  function init(){
    const saved=localStorage.getItem(KEY)||'all';
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.classList.toggle('active',b.dataset.nearbyFilter===saved);
      b.addEventListener('click',()=>{
        localStorage.setItem(KEY,b.dataset.nearbyFilter||'all');
      },true);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 42 ===== */
(function(){
  const FILTER='myevent_nearby_filter_v2';
  const MAP='myevent_nearby_map_type_v1';
  let cityLayer=null, poiLayer=null, lastKey='';
  let started=false;

  function map(){return window.myeventNearbyLeafletMap||null}
  function savedPos(){
    try{
      const p=JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null');
      return p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)?{lat:+p.lat,lon:+p.lon}:null;
    }catch(e){return null}
  }
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function cityIcon(name){
    return L.divIcon({
      className:'myeventCityMarker',
      html:'<div class="myeventCityLabel"><span class="dot"></span><span class="name">'+esc(name)+'</span></div>',
      iconSize:[1,1],iconAnchor:[5,6]
    });
  }
  function poiIcon(name,emoji,purple){
    return L.divIcon({
      className:'myeventInterestMarker',
      html:'<div class="myeventInterestLabel '+(purple?'purple':'')+'"><span class="pin">'+emoji+'</span><span class="name">'+esc(name)+'</span></div>',
      iconSize:[1,1],iconAnchor:[14,14]
    });
  }

  async function load(lat,lon){
    const m=map(); if(!m||!window.L)return;
    const key=lat.toFixed(3)+','+lon.toFixed(3);
    if(lastKey===key && cityLayer)return;
    lastKey=key;

    if(!cityLayer)cityLayer=L.layerGroup().addTo(m);
    if(!poiLayer)poiLayer=L.layerGroup().addTo(m);
    cityLayer.clearLayers(); poiLayer.clearLayers();

    // Villes : rayon plus large pour conserver les noms visibles comme sur la capture.
    const cq='[out:json][timeout:12];nwr(around:60000,'+lat+','+lon+')[place~"city|town|village"];out center tags 100;';
    // Points intéressants : rayon local.
    const pq='[out:json][timeout:12];(nwr(around:15000,'+lat+','+lon+')[tourism~"attraction|viewpoint|museum|theme_park|zoo|aquarium"];nwr(around:15000,'+lat+','+lon+')[leisure~"park|golf_course|sports_centre|stadium|pitch"];nwr(around:15000,'+lat+','+lon+')[amenity~"restaurant|cafe|cinema"];);out center tags 100;';

    try{
      const [a,b]=await Promise.all([
        fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(cq)),
        fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(pq))
      ]);
      if(a.ok){
        const d=await a.json(), seen=new Set();
        (d.elements||[]).forEach(x=>{
          const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
          const name=x.tags?.name;
          if(!name||!p[0]||!p[1]||seen.has(name))return;
          seen.add(name);
          L.marker(p,{icon:cityIcon(name),interactive:false,zIndexOffset:-200}).addTo(cityLayer);
        });
      }
      if(b.ok){
        const d=await b.json(), seen=new Set();
        (d.elements||[]).forEach(x=>{
          const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
          const t=x.tags||{},name=t.name;
          if(!name||!p[0]||!p[1]||seen.has(name))return;
          seen.add(name);
          let emoji='🎯',purple=false;
          if(t.amenity==='restaurant')emoji='🍽️';
          else if(t.amenity==='cafe')emoji='☕';
          else if(t.amenity==='cinema')emoji='🎬';
          else if(t.leisure==='golf_course')emoji='⛳';
          else if(t.leisure==='sports_centre'||t.leisure==='stadium'||t.leisure==='pitch')emoji='⚽';
          else if(t.leisure==='park')emoji='🌳';
          else if(t.tourism==='viewpoint')emoji='👀',purple=true;
          else if(t.tourism==='museum')emoji='🏛️',purple=true;
          else emoji='🎯',purple=true;
          const marker=L.marker(p,{icon:poiIcon(name,emoji,purple)});
          marker.__nearbyType=(t.amenity==='restaurant'||t.amenity==='cafe')?'restaurant':
            (t.leisure==='golf_course'||t.leisure==='sports_centre'||t.leisure==='stadium'||t.leisure==='pitch')?'sport':'activity';
          marker.bindPopup('<b>'+esc(name)+'</b><br>📍 Point intéressant à proximité').addTo(poiLayer);
        });
      }
      window.myeventNearbyCityLayer=cityLayer;
      window.myeventNearbyInterestLayer=poiLayer;
    }catch(e){}
  }

  function openFix(){
    const panel=document.getElementById('myeventNearbyPanel');
    const tools=document.getElementById('myeventNearbyMapTools');
    if(tools)tools.scrollLeft=0;

    const m=map();
    if(!m)return;
    const p=savedPos();
    if(p){
      // Recentrage systématique sur la position mémorisée à chaque ouverture.
      m.setView([p.lat,p.lon],14,{animate:false});
      load(p.lat,p.lon);
    }
    // Restaurer visuellement le filtre choisi.
    const saved=localStorage.getItem(FILTER)||'all';
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.classList.toggle('active',b.dataset.nearbyFilter===saved);
    });
    setTimeout(()=>m.invalidateSize(),120);
  }

  function init(){
    if(started)return; started=true;
    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      const obs=new MutationObserver(()=>{
        if(panel.classList.contains('open'))setTimeout(openFix,80);
      });
      obs.observe(panel,{attributes:true,attributeFilter:['class']});
    }
    // Si la carte est déjà ouverte.
    setTimeout(openFix,300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 43 ===== */
(function(){
  const CITY_KEY='myeventNearbyCities76';
  const POI_KEY='myeventNearbyPois76';
  let cityLayer=null,poiLayer=null,lastKey='';
  const endpoints=[
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];

  function map(){return window.myeventNearbyLeafletMap||null}
  function pos(){
    try{
      const p=JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null');
      return p&&+p.lat&&+p.lon?{lat:+p.lat,lon:+p.lon}:null;
    }catch(e){return null}
  }
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function dist(a,b,c,d){
    const R=6371,rad=Math.PI/180;
    const x=(c-a)*rad,y=(d-b)*rad;
    const h=Math.sin(x/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(y/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }
  function cityIcon(name){
    return L.divIcon({
      className:'myeventCityMarker',
      html:'<div class="myeventCityLabel"><span class="dot"></span><span class="name">'+esc(name)+'</span></div>',
      iconSize:[170,28],iconAnchor:[5,14]
    });
  }
  function poiIcon(name,emoji,purple){
    return L.divIcon({
      className:'myeventInterestMarker',
      html:'<div class="myeventInterestLabel '+(purple?'purple':'')+'"><span class="pin">'+emoji+'</span><span class="name">'+esc(name)+'</span></div>',
      iconSize:[175,36],iconAnchor:[14,18]
    });
  }
  async function request(q){
    for(const url of endpoints){
      try{
        const r=await fetch(url+'?data='+encodeURIComponent(q),{mode:'cors'});
        if(r.ok)return await r.json();
      }catch(e){}
    }
    return {elements:[]};
  }
  async function load(lat,lon){
    const m=map(); if(!m||!window.L)return;
    const key=lat.toFixed(3)+','+lon.toFixed(3);
    if(lastKey===key&&cityLayer&&poiLayer)return;
    lastKey=key;
    if(!cityLayer)cityLayer=L.layerGroup().addTo(m);
    if(!poiLayer)poiLayer=L.layerGroup().addTo(m);
    cityLayer.clearLayers();poiLayer.clearLayers();

    const cityQ='[out:json][timeout:15];nwr(around:70000,'+lat+','+lon+')[place~"city|town"];out center tags 120;';
    const poiQ='[out:json][timeout:15];(nwr(around:10000,'+lat+','+lon+')[tourism~"attraction|viewpoint|museum|theme_park|zoo|aquarium"];nwr(around:10000,'+lat+','+lon+')[leisure~"park|golf_course|sports_centre|stadium|pitch"];nwr(around:10000,'+lat+','+lon+')[amenity~"restaurant|cafe|cinema"];);out center tags 120;';

    const [cities,pois]=await Promise.all([request(cityQ),request(poiQ)]);

    const cityItems=[];
    (cities.elements||[]).forEach(x=>{
      const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
      const name=x.tags?.name;
      if(name&&p[0]&&p[1])cityItems.push({name,p,d:dist(lat,lon,+p[0],+p[1])});
    });
    cityItems.sort((a,b)=>a.d-b.d);
    const seenCity=new Set();
    cityItems.slice(0,14).forEach(x=>{
      if(seenCity.has(x.name))return;
      seenCity.add(x.name);
      L.marker(x.p,{icon:cityIcon(x.name),interactive:false,zIndexOffset:-100}).addTo(cityLayer);
    });

    const poiItems=[];
    (pois.elements||[]).forEach(x=>{
      const p=x.type==='node'?[x.lat,x.lon]:[x.center?.lat,x.center?.lon];
      const t=x.tags||{},name=t.name;
      if(!name||!p[0]||!p[1])return;
      let emoji='🎯',type='activity',purple=false;
      if(t.amenity==='restaurant')emoji='🍽️',type='restaurant';
      else if(t.amenity==='cafe')emoji='☕',type='restaurant';
      else if(t.amenity==='cinema')emoji='🎬',type='activity';
      else if(t.leisure==='golf_course')emoji='⛳',type='sport';
      else if(['sports_centre','stadium','pitch'].includes(t.leisure))emoji='⚽',type='sport';
      else if(t.leisure==='park')emoji='🌳',type='activity';
      else if(t.tourism==='viewpoint')emoji='👀',purple=true;
      else if(t.tourism==='museum')emoji='🏛️',purple=true;
      else if(t.tourism)emoji='🎯',purple=true;
      poiItems.push({name,p,type,emoji,purple,d:dist(lat,lon,+p[0],+p[1])});
    });
    poiItems.sort((a,b)=>a.d-b.d);
    const seenPoi=new Set();
    poiItems.slice(0,45).forEach(x=>{
      if(seenPoi.has(x.name))return;
      seenPoi.add(x.name);
      const mk=L.marker(x.p,{icon:poiIcon(x.name,x.emoji,x.purple)});
      mk.__nearbyType=x.type;
      mk.bindPopup('<b>'+esc(x.name)+'</b><br>📍 Point intéressant à proximité');
      mk.addTo(poiLayer);
    });
    window.myeventNearbyCityLayer=cityLayer;
    window.myeventNearbyInterestLayer=poiLayer;
    window.myeventNearbyRealPoiItems=poiItems;
    applyFilter(localStorage.getItem('myevent_nearby_filter_v2')||'all');
  }

  function applyFilter(kind){
    if(!poiLayer)return;
    poiLayer.eachLayer(m=>{
      const t=m.__nearbyType||'activity';
      const visible=kind==='all'||(kind==='sport'&&t==='sport')||
        (kind==='restaurant'&&t==='restaurant')||
        (kind==='activity'&&t==='activity');
      if(visible)m.addTo(poiLayer);else poiLayer.removeLayer(m);
    });
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.classList.toggle('active',b.dataset.nearbyFilter===kind);
    });
  }

  function resetFilterScroll(){
    const el=document.getElementById('myeventNearbyMapTools');
    if(!el)return;
    el.scrollLeft=0;
    requestAnimationFrame(()=>el.scrollLeft=0);
    setTimeout(()=>el.scrollLeft=0,80);
    setTimeout(()=>el.scrollLeft=0,300);
  }

  function init(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const m=map();
      if(m){
        clearInterval(timer);
        const p=pos();
        if(p)load(p.lat,p.lon);
        m.on('moveend',()=>{
          const c=m.getCenter();
          const p=pos();
          if(p&&dist(p.lat,p.lon,c.lat,c.lng)>1.5){
            // Ne pas déplacer les marqueurs à chaque mouvement : on recharge
            // seulement si l'utilisateur s'éloigne vraiment de sa zone.
          }
        });
      }
      if(tries>120)clearInterval(timer);
    },100);

    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(b=>{
      b.addEventListener('click',()=>{
        localStorage.setItem('myevent_nearby_filter_v2',b.dataset.nearbyFilter||'all');
        applyFilter(b.dataset.nearbyFilter||'all');
      },true);
    });

    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      new MutationObserver(()=>{
        if(panel.classList.contains('open')){
          resetFilterScroll();
          const p=pos();
          if(p)load(p.lat,p.lon);
        }
      }).observe(panel,{attributes:true,attributeFilter:['class']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 44 ===== */
(function(){
  const GAP={lat:44.5594,lon:6.0786};

  function map(){return window.myeventNearbyLeafletMap||null}
  function pos(){
    try{
      const p=JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null');
      return p&&+p.lat&&+p.lon?{lat:+p.lat,lon:+p.lon}:null;
    }catch(e){return null}
  }
  function distance(a,b,c,d){
    const R=6371,rad=Math.PI/180;
    const x=(c-a)*rad,y=(d-b)*rad;
    const h=Math.sin(x/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(y/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }
  function esc(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function cityIcon(name){
    return L.divIcon({
      className:'myeventCityMarker',
      html:'<div class="myeventCityLabel"><span class="dot"></span><span class="name">'+esc(name)+'</span></div>',
      iconSize:[180,30],iconAnchor:[5,15]
    });
  }
  function poiIcon(name,emoji,purple){
    return L.divIcon({
      className:'myeventInterestMarker',
      html:'<div class="myeventInterestLabel '+(purple?'purple':'')+'"><span class="pin">'+emoji+'</span><span class="name">'+esc(name)+'</span></div>',
      iconSize:[210,40],iconAnchor:[14,20]
    });
  }

  function addFallback(){
    const m=map(),p=pos();
    if(!m||!p||!window.L)return;
    // Fallback uniquement pour la zone de Gap : les données sont utilisées
    // lorsque le service cartographique externe ne répond pas.
    if(distance(p.lat,p.lon,GAP.lat,GAP.lon)>35)return;

    let cities=window.myeventNearbyCityLayer;
    let pois=window.myeventNearbyInterestLayer;
    if(!cities)cities=L.layerGroup().addTo(m);
    if(!pois)pois=L.layerGroup().addTo(m);
    window.myeventNearbyCityLayer=cities;
    window.myeventNearbyInterestLayer=pois;

    if(cities.getLayers().length===0){
      const cityData=[
        ['Gap',44.55944,6.07861],
        ['Romette',44.589,6.106],
        ['Pelleautier',44.516,6.018],
        ['Tallard',44.463,6.055],
        ['Rambaud',44.575,6.136]
      ];
      cityData.forEach(x=>L.marker([x[1],x[2]],{
        icon:cityIcon(x[0]),interactive:false,zIndexOffset:1000
      }).addTo(cities));
    }

    if(pois.getLayers().length===0){
      const poiData=[
        ['Place Jean Marcellin','📍',44.55907,6.07967,false,'activity'],
        ['Golf de Gap-Bayard','⛳',44.62127,6.08386,false,'sport'],
        ['Auberge de Pelleautier','🍽️',44.515906,6.018496,false,'restaurant'],
        ['Le Mas d’Estello','🍽️',44.44615,6.03175,true,'restaurant']
      ];
      poiData.forEach(x=>{
        const mk=L.marker([x[2],x[3]],{
          icon:poiIcon(x[0],x[1],x[4]),zIndexOffset:1200
        });
        mk.__nearbyType=x[5];
        mk.bindPopup('<b>'+esc(x[0])+'</b>');
        mk.addTo(pois);
      });
    }
  }

  function run(){
    let n=0;
    const t=setInterval(()=>{
      n++;
      if(map()){
        // Laisser d'abord la recherche API essayer de remplir les couches.
        setTimeout(addFallback,1800);
        setTimeout(addFallback,5000);
        clearInterval(t);
      }
      if(n>100)clearInterval(t);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();

/* ===== original inline script 45 ===== */
(function(){
  /* Renforce le rendu après les appels Overpass et conserve les couches existantes. */
  function restyle(){
    document.querySelectorAll('#myeventNearbyPanel .myeventCityLabel .name').forEach(el=>{
      el.style.background='transparent';
      el.style.border='0';
      el.style.boxShadow='none';
      el.style.padding='0';
    });
    document.querySelectorAll('#myeventNearbyPanel .myeventInterestLabel .name').forEach(el=>{
      el.style.background='transparent';
      el.style.border='0';
      el.style.boxShadow='none';
      el.style.padding='0';
    });
  }
  function init(){
    restyle();
    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      new MutationObserver(restyle).observe(panel,{subtree:true,childList:true});
    }
    setInterval(restyle,2500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 46 ===== */
(function(){
  const MAP_KEY='myevent_nearby_map_type_v1';
  let labelsLayer=null;
  let lastMap=null;

  function getMap(){return window.myeventNearbyLeafletMap||null}

  function removeCityMarkers(){
    try{
      const layer=window.myeventNearbyCityLayer;
      if(layer && typeof layer.clearLayers==='function') layer.clearLayers();
    }catch(e){}
    document.querySelectorAll('#myeventNearbyPanel .myeventCityMarker').forEach(el=>el.remove());
  }

  function setNaturalMapType(type){
    const m=getMap();
    if(!m||!window.L)return false;

    try{
      if(window.myeventNearbyBaseLayer)m.removeLayer(window.myeventNearbyBaseLayer);
    }catch(e){}
    try{
      if(labelsLayer)m.removeLayer(labelsLayer);
    }catch(e){}

    let url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attr='&copy; OpenStreetMap';

    if(type==='satellite'){
      url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr='Tiles &copy; Esri';
    }else if(type==='terrain'){
      url='https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attr='&copy; OpenTopoMap';
    }

    window.myeventNearbyBaseLayer=L.tileLayer(url,{maxZoom:19,attribution:attr}).addTo(m);

    /* En satellite, Esri fournit une couche séparée avec les noms de lieux
       et frontières : on obtient ainsi des noms naturels, sans les créer en JS. */
    if(type==='satellite'){
      labelsLayer=L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {maxZoom:19,opacity:1,attribution:'&copy; Esri'}
      ).addTo(m);
      labelsLayer.bringToFront();
    }

    lastMap=m;
    try{localStorage.setItem(MAP_KEY,type)}catch(e){}
    removeCityMarkers();
    return true;
  }

  // API publique unique utilisée par les autres modules de la carte.
  window.myeventSetNearbyMapType=setNaturalMapType;

  function apply(){
    removeCityMarkers();
    const m=getMap();
    if(!m)return false;
    const saved=localStorage.getItem(MAP_KEY)||'default';
    return setNaturalMapType(saved);
  }

  function init(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const m=getMap();
      if(m){
        clearInterval(timer);
        apply();
        /* Les anciens scripts peuvent tenter de remettre leurs villes de
           secours. On les vide, mais on ne touche jamais aux lieux importants. */
        setInterval(()=>{
          if(getMap()===m)removeCityMarkers();
        },1000);
      }
      if(tries>120)clearInterval(timer);
    },100);

    document.querySelectorAll('#myeventNearbyPanel [data-map-type]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const type=btn.dataset.mapType||'default';
        let n=0;
        const go=()=>{
          n++;
          if(setNaturalMapType(type)||n>15)return;
          setTimeout(go,100);
        };
        go();
      },true);
    });

    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      new MutationObserver(()=>{
        if(panel.classList.contains('open')){
          removeCityMarkers();
          setTimeout(apply,250);
          setTimeout(removeCityMarkers,1800);
        }
      }).observe(panel,{attributes:true,attributeFilter:['class']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 47 ===== */
(function(){
  function removeArtificialPoints(){
    try{
      const layer=window.myeventNearbyInterestLayer;
      if(layer && typeof layer.clearLayers==='function') layer.clearLayers();
    }catch(e){}
    document.querySelectorAll('#myeventNearbyPanel .myeventInterestMarker, #myeventNearbyPanel .myeventLeisureMarker').forEach(el=>el.remove());
  }
  function init(){
    removeArtificialPoints();
    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      new MutationObserver(removeArtificialPoints).observe(panel,{subtree:true,childList:true});
    }
    setInterval(removeArtificialPoints,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== original inline script 48 ===== */
(function(){
  const KEY='myevent_nearby_map_type_v1';
  let applying=false;

  function readType(){
    try{return localStorage.getItem(KEY)||'default'}catch(e){return 'default'}
  }
  function saveType(type){
    try{localStorage.setItem(KEY,type||'default')}catch(e){}
  }
  function syncButtons(type){
    document.querySelectorAll('#myeventNearbyPanel [data-map-type]').forEach(b=>{
      b.classList.toggle('active',(b.dataset.mapType||'default')===type);
    });
  }
  function apply(type){
    if(applying)return;
    const map=window.myeventNearbyLeafletMap;
    if(!map || !window.L || typeof window.myeventSetNearbyMapType!=='function')return false;
    applying=true;
    try{
      window.myeventSetNearbyMapType(type);
      syncButtons(type);
      return true;
    }catch(e){return false}
    finally{setTimeout(()=>{applying=false},120)}
  }
  function applyWhenReady(type){
    syncButtons(type);
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(apply(type)||tries>=50)clearInterval(timer);
    },120);
  }

  function init(){
    const saved=readType();
    syncButtons(saved);

    document.querySelectorAll('#myeventNearbyPanel [data-map-type]').forEach(btn=>{
      btn.addEventListener('click',function(){
        const type=btn.dataset.mapType||'default';
        saveType(type);
        syncButtons(type);
        applyWhenReady(type);
      },true);
    });

    const panel=document.getElementById('myeventNearbyPanel');
    if(panel){
      new MutationObserver(()=>{
        if(panel.classList.contains('open')){
          const type=readType();
          syncButtons(type);
          setTimeout(()=>applyWhenReady(type),100);
        }
      }).observe(panel,{attributes:true,attributeFilter:['class']});
    }

    /* Le script de la carte peut recréer les tuiles après un changement de
       position. On remet alors uniquement le choix mémorisé. */
    let last=readType();
    setInterval(()=>{
      const current=readType();
      if(current!==last){last=current;syncButtons(current)}
      const p=document.getElementById('myeventNearbyPanel');
      if(p && p.classList.contains('open')){
        const map=window.myeventNearbyLeafletMap;
        if(map && !map.__myeventSavedMapType){
          applyWhenReady(current);
          map.__myeventSavedMapType=current;
        }
      }
    },1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
