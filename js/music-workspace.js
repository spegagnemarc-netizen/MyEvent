/* Internal Music navigation. Existing application navigation and camera stay intact. */
(function(){
  const M=window.MyEventMusic,S=window.MyEventMusicSession,P=window.MyEventMusicPlayback;
  const $=id=>document.getElementById(id),root=$('musicHome');if(!M||!root)return;
  const esc=M.escape,meta=v=>esc(M.metadata(v)),ctx=()=>window.myeventMusicContext?.()||{};
  const home=document.createElement('div');home.id='musicLanding';while(root.firstChild)home.appendChild(root.firstChild);root.appendChild(home);
  const page=document.createElement('section');page.id='musicScreen';page.hidden=true;root.appendChild(page);
  let screen='home',history=[],results=[],eventData=null,revision=0,nextPageToken=null,activeQuery='';
  const titles={library:'Bibliothèque',event:'Playlist d’événement',dj:'Mode DJ',discover:'Découvrir',ai:'Music IA',player:'Lecteur'};
  const notice=t=>{const el=$('musicScreenStatus')||$('musicProviderStatus');if(el)el.textContent=t;};
  const button=(label,fn,parent=page)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);parent.appendChild(b);return b;};
  function back(){go(history.pop()||'home',false);}
  function shell(name){page.innerHTML='<header class="musicScreenHead"><button data-back aria-label="Retour">‹ Retour</button><h2>'+titles[name]+'</h2></header><p id="musicScreenStatus" role="status" aria-live="polite"></p><div id="musicScreenBody"></div>';page.querySelector('[data-back]').onclick=back;return $('musicScreenBody');}
  function go(name,push=true){
    if(!titles[name]&&name!=='home')name='home';S.get();if(push&&name!==screen)history.push(screen);screen=name;revision++;
    M.openMusic();home.hidden=name!=='home';page.hidden=name==='home';S.update({screen:name});
    for(const id of ['musicFavoritesPanel','musicEventPanel'])$(id)?.classList.remove('open');
    if(name==='home'){renderHome();return;}
    const body=shell(name);
    if(name==='library')library(body);
    if(name==='event'){button('Ajouter des morceaux',()=>go('discover'),body);button('Actualiser',()=>M.loadEventPlaylist(),body);M.loadEventPlaylist();}
    if(name==='discover')discover(body);
    if(name==='ai')draft(body);
    if(name==='dj')dj(body);
    if(name==='player'){const track=P.current||S.get().current;if(track)M.openPlayer(track);else body.textContent='Choisis un morceau pour ouvrir le lecteur.';}
    root.scrollTop=0;
  }
  function rows(tracks,target,extra){
    if(!tracks.length){const p=document.createElement('p');p.className='musicEmpty';p.textContent='Aucun morceau pour le moment.';target.appendChild(p);return;}
    tracks.forEach((track,index)=>{const row=document.createElement('article');row.className='musicListRow';
      row.innerHTML='<button class="musicTrackOpen"><img alt="" loading="lazy" src="'+esc(track.thumbnail_url||'')+'"><span><strong>'+meta(track.title)+'</strong><small>'+meta(track.artist)+'</small></span></button>';
      row.querySelector('button').onclick=()=>M.openPlayer(track,tracks);button('⋮',()=>menu(track),row).setAttribute('aria-label','Actions pour '+M.metadata(track.title));extra?.(row,track,index);target.appendChild(row);
    });
  }
  function menu(track){
    $('musicTrackMenu')?.remove();const dialog=document.createElement('dialog');dialog.id='musicTrackMenu';dialog.innerHTML='<h3>'+meta(track.title)+'</h3>';document.body.appendChild(dialog);
    const favorite=button('♡ Favori',()=>{},dialog);favorite.disabled=true;M.bindFavorite(track,favorite);
    button('Ajouter à une playlist',()=>{const name=prompt('Nom de la playlist personnelle');if(!name?.trim())return;const s=S.get();let list=s.playlists.find(p=>p.name===name.trim());if(!list){list={name:name.trim(),tracks:[]};s.playlists.push(list);}if(!list.tracks.some(t=>S.key(t)===S.key(track)))list.tracks.push(track);S.save();dialog.close();},dialog);
    button('Ajouter à l’événement',async e=>{await M.addTrackToEvent(track);dialog.close();},dialog);
    button('File DJ',()=>{S.get().dj.push({...track,locked:false});S.save();dialog.close();go('dj');},dialog);
    const selfie=button('Utiliser ce son dans Selfie — à venir',()=>{},dialog);selfie.disabled=true;
    button('Voir l’artiste',()=>{dialog.close();go('discover');search(track.artist);},dialog);
    button('Suivre cet artiste',()=>{const s=S.get();if(track.artist&&!s.artists.includes(track.artist))s.artists.push(track.artist);S.save();dialog.close();},dialog);
    button('Titres similaires',()=>{dialog.close();go('discover');search(track.artist+' '+track.title);},dialog);
    button('Partager',async()=>{try{if(track.provider!=='youtube')throw Error('Partage non disponible pour ce fournisseur.');const url='https://www.youtube.com/watch?v='+encodeURIComponent(track.provider_track_id);if(navigator.share)await navigator.share({title:M.metadata(track.title),url});else await navigator.clipboard.writeText(url);dialog.close();}catch(e){if(e.name!=='AbortError')notice(e.message);}},dialog);
    button('Fermer',()=>dialog.close(),dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }
  async function library(body){
    body.innerHTML='<p>Playlists, artistes et historique sont conservés sur cet appareil, séparément pour chaque compte. Les favoris sont synchronisés avec Supabase.</p><h3>Morceaux likés</h3><div id="musicLiked"></div><h3>Mes playlists</h3><div id="musicPersonal"></div><h3>Artistes suivis</h3><div id="musicArtists"></div><h3>Écoutés récemment</h3><div id="musicHistory"></div>';
    const s=S.get();rows(s.recent,$('musicHistory'));
    s.playlists.forEach((list,i)=>{const section=document.createElement('details');const summary=document.createElement('summary');summary.textContent=list.name;section.appendChild(summary);rows(list.tracks,section,(row,t,n)=>button('Retirer',()=>{list.tracks.splice(n,1);S.save();go('library',false);},row));button('Supprimer la playlist',()=>{s.playlists.splice(i,1);S.save();go('library',false);},section);$('musicPersonal').appendChild(section);});
    s.artists.forEach((artist,i)=>{button(artist,()=>{go('discover');search(artist);},$('musicArtists'));button('Ne plus suivre '+artist,()=>{s.artists.splice(i,1);S.save();go('library',false);},$('musicArtists'));});
    await M.loadFavorites();
  }
  function discover(body){body.innerHTML='<form id="musicDiscoverForm"><label>Rechercher sur YouTube<input id="musicDiscoverQuery" type="search" minlength="2" required></label><button>Rechercher</button></form><div id="musicDiscoverResults"></div><button type="button" id="musicLoadMore" hidden>Afficher plus de résultats</button>';$('musicDiscoverQuery').value=S.get().query;rows(results,$('musicDiscoverResults'));const more=$('musicLoadMore');more.hidden=!nextPageToken;more.onclick=()=>search(activeQuery,null,true);
    $('musicDiscoverForm').onsubmit=e=>{e.preventDefault();search($('musicDiscoverQuery').value);};
  }
  let searchVersion=0;
  let searchController=null;
  async function search(q,artContext,append=false){q=q?.trim();if(!q||q.length<2)return;if(artContext)S.update({artContext});const version=++searchVersion;const view=revision;searchController?.abort();searchController=new AbortController();const controller=searchController;if(!append){activeQuery=q;nextPageToken=null;results=[];}S.update({query:q});const input=$('musicDiscoverQuery');if(input)input.value=q;const box=$('musicDiscoverResults');if(box&&!append)box.replaceChildren();notice(append?'Chargement de plus de résultats…':'Recherche « '+q+' »…');try{const page=append&&nextPageToken?'&pageToken='+encodeURIComponent(nextPageToken):'';const r=await fetch('/api/search-music?q='+encodeURIComponent(q)+page,{signal:controller.signal,cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Recherche indisponible');if(controller!==searchController||version!==searchVersion||view!==revision)return;const incoming=data.items||[];const seen=new Set(results.map(S.key));results=append?results.concat(incoming.filter(t=>!seen.has(S.key(t)))):incoming;nextPageToken=data.nextPageToken||null;const current=$('musicDiscoverResults');if(current){current.replaceChildren();rows(results,current);}const more=$('musicLoadMore');if(more)more.hidden=!nextPageToken;notice(results.length+' résultat(s) chargés · '+q+(nextPageToken?' · plus disponibles':''));}catch(e){if(e.name==='AbortError')return;if(controller===searchController&&version===searchVersion){if(!append)results=[];const current=$('musicDiscoverResults');if(current&&!append)current.replaceChildren();notice(e.message);}}}
  function editable(key,body){
    const list=S.get()[key];rows(list,body,(row,t,i)=>{
      button(t.locked?'🔒 Déverrouiller':'Verrouiller',()=>{t.locked=!t.locked;S.save();go(screen,false);},row);
      for(const [label,delta] of [['↑',-1],['↓',1]]){const b=button(label,()=>{const j=i+delta;if(j<0||j>=list.length||t.locked||list[j].locked)return;[list[i],list[j]]=[list[j],list[i]];S.save();go(screen,false);},row);b.disabled=t.locked||!list[i+delta]||list[i+delta]?.locked;b.setAttribute('aria-label',delta<0?'Monter le morceau':'Descendre le morceau');}
      button('Retirer',()=>{list.splice(i,1);S.save();go(screen,false);},row).disabled=!!t.locked;
      if(key==='draft')button('Remplacer',()=>choose(t,i),row).disabled=!!t.locked;
    });
  }
  function choose(track,index){
    const dialog=document.createElement('dialog');dialog.className='musicChoose';dialog.innerHTML='<h3>'+ (track?'Remplacer le morceau':'Ajouter un morceau')+'</h3><form><input aria-label="Titre ou artiste" required minlength="2"><button>Rechercher</button></form><p role="status"></p><div></div>';document.body.appendChild(dialog);
    let version=0;dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const token=++version;const msg=dialog.querySelector('p');msg.textContent='Recherche…';try{const r=await fetch('/api/search-music?q='+encodeURIComponent(dialog.querySelector('input').value));const data=await r.json();if(!r.ok)throw Error(data.error||'Recherche indisponible');if(token!==version||!dialog.open)return;const box=dialog.querySelector('div');box.replaceChildren();(data.items||[]).forEach(t=>button(M.metadata(t.title),()=>{const list=S.get().draft;if(track){if(list[index]!==track||track.locked)return;list[index]=t;}else list.push(t);S.save();dialog.close();go('ai',false);},box));msg.textContent=(data.items||[]).length+' résultat(s)';}catch(e){msg.textContent=e.message;}};button('Fermer',()=>dialog.close(),dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
  }
  function draft(body){
    body.innerHTML='<label>Décris ta playlist<textarea id="musicPrompt" placeholder="Anniversaire, années 2000, route…"></textarea></label><p>La génération IA n’est pas encore connectée. Compose et modifie librement ta proposition avec la recherche réelle.</p><div id="musicDraftActions"></div><div id="musicDraftTracks"></div>';
    $('musicPrompt').value=S.get().prompt||'';$('musicPrompt').oninput=e=>S.update({prompt:e.target.value});
    button('Ajouter un morceau',()=>choose(),$('musicDraftActions'));
    for(const label of ['Proposer avec l’IA','Ajoute plus de…','Garde ceux-là et refais le reste'])button(label+' — à venir',()=>{},$('musicDraftActions')).disabled=true;
    editable('draft',$('musicDraftTracks'));
    button('Enregistrer comme playlist',()=>{const name=prompt('Nom de la playlist');if(!name?.trim()||!S.get().draft.length)return;S.get().playlists.push({name:name.trim(),tracks:S.get().draft.map(t=>({...t}))});S.save();notice('Playlist enregistrée sur cet appareil.');},body);
    button('Ajouter à l’événement',async e=>{const eventId=ctx().event?.id,userId=ctx().user?.id;const tracks=[...S.get().draft];let count=0;e.currentTarget.disabled=true;for(const t of tracks){if(ctx().event?.id!==eventId||ctx().user?.id!==userId)break;if(await M.addTrackToEvent(t))count++;else break;}notice(count+' / '+tracks.length+' morceau(x) ajouté(s).'+(count<tracks.length?' Consulte le statut de la playlist pour le dernier échec.':''));e.target.disabled=false;},body);
    button('Envoyer au Mode DJ',()=>{S.update({dj:S.get().draft.map(t=>({...t}))});go('dj');},body);
  }
  function dj(body){
    body.innerHTML='<p>File manuelle de cet appareil. La playlist événement reste la file commune avec votes.</p><div id="musicDJControls"></div><h3>File d’attente</h3><div id="musicDJQueue"></div><details><summary>Paramètres DJ</summary><p>Mode manuel. Auto/IA, transitions, normalisation et effets nécessitent un moteur compatible et ne sont pas activés.</p></details>';
    const controls=$('musicDJControls');button('Précédent',()=>P.previous(),controls);button('Lire la file',()=>{const tracks=S.get().dj;if(tracks.length){M.openPlayer(tracks[0],tracks);P.play(tracks[0],tracks);}},controls);button('Suivant',()=>P.next(),controls);
    button('Playlist commune et votes',()=>go('event'),controls);
    button('Importer la file de l’événement',async()=>{try{const {sb,event}=ctx(),playlist=await M.ensureEventPlaylist();const r=await sb.from('music_playlist_items').select('position,is_locked,track:music_tracks(*)').eq('event_id',event.id).eq('playlist_id',playlist.id).order('position',{ascending:true});if(r.error)throw r.error;S.update({dj:(r.data||[]).filter(x=>x.track).map(x=>({...x.track,locked:x.is_locked}))});go('dj',false);}catch(e){notice(e.message);}},controls);
    editable('dj',$('musicDJQueue'));
  }
  function renderHome(){
    let extra=$('musicHomeExtras');if(!extra){extra=document.createElement('section');extra.id='musicHomeExtras';home.insertBefore(extra,home.querySelector('.musicSection'));}
    extra.innerHTML='<div class="musicCards"><button data-go="discover" class="musicIllustrated">⌕<b>Découvrir</b><small>Explorer YouTube</small></button><button data-go="ai" class="musicIllustrated">✦<b>Music IA</b><small>Composer une proposition</small></button><button data-go="library" class="musicIllustrated">♥<b>Bibliothèque</b><small>Retrouver vos titres</small></button></div><h3>Écoutés récemment</h3><div id="musicRecent"></div><h3>Genres</h3><div id="musicGenres"></div>';
    extra.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));rows(S.get().recent.slice(0,3),$('musicRecent'));
    const genres=['Pop','Rap','Hip-Hop','R&B','Jazz','Rock','Électro','Dance','Variété française','Chanson française','Latino','Reggaeton','Reggae','Classique','K-Pop','Métal','Afro','Afrobeats','Amapiano','Country','Soul','Funk','Disco','House','Techno','Trance','Drum & Bass','Dubstep','Gospel','Blues','Folk','Indie','Alternative','Punk','Hard Rock','Musique du monde','Oriental','Raï','Zouk','Kompa','Salsa','Bachata','Années 60','Années 70','Années 80','Années 90','Années 2000','Années 2010'];for(const genre of genres){const key='genre:'+genre.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');const b=button(genre,()=>{go('discover');search(genre,key);},$('musicGenres'));b.classList.add('musicGenreCard');b.dataset.artKey=key;const art=S.get().artwork[key]?.thumbnail_url;if(art)b.style.setProperty('background-image','linear-gradient(180deg,rgba(5,8,12,.06),rgba(5,8,12,.78)),url("'+art.replace(/"/g,'%22')+'")','important');}
  }
  root.addEventListener('click',e=>{const b=e.target.closest('[data-music-action],#musicFavoritesBtn,#musicEventPlaylistsBtn,[data-music-filter],.musicChips button');if(!b)return;
    const action=b.dataset.musicAction,filter=b.dataset.musicFilter;
    if(action||b.id==='musicFavoritesBtn'||b.id==='musicEventPlaylistsBtn'){e.stopImmediatePropagation();go(action==='event'||b.id==='musicEventPlaylistsBtn'?'event':action==='dj'?'dj':'library');}
    else if(filter==='trends'||b.matches('.musicChips button')){e.stopImmediatePropagation();go('discover');const q=filter?'musique tendances France':b.textContent;const key=filter?'section:tendances':'mood:'+q.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');search(q,key);}
    else if(filter==='moods')home.querySelector('.musicChips')?.scrollIntoView();else if(filter==='genres')$('musicGenres')?.scrollIntoView();else if(filter==='for-you')$('musicHomeExtras')?.scrollIntoView();
  },true);
  window.addEventListener('music-library-loaded',()=>{if(screen==='library'&&$('musicLiked')){$('musicLiked').appendChild($('musicFavoritesPanel'));$('musicFavoritesPanel').querySelector('[data-favorites-close]').onclick=back;}else $('musicFavoritesPanel')?.classList.remove('open');});
  window.addEventListener('music-event-loaded',e=>{eventData=e.detail;if(screen==='event'){$('musicScreenBody').appendChild($('musicEventPanel'));$('musicClosePlaylist').onclick=back;eventControls();participants();}else $('musicEventPanel')?.classList.remove('open');});
  function eventControls(){
    const {user,event}=ctx();if(!eventData||!user||!event)return;
    const owner=event.creator_id===user.id,playlist=eventData.playlist;
    const items=[...eventData.items].sort((a,b)=>(a.position??Infinity)-(b.position??Infinity)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
    const panel=$('musicEventPanel');const controls=document.createElement('div');panel.appendChild(controls);
    async function change(table,id,patch){try{if(ctx().event?.id!==event.id)throw Error('L’événement a changé.');let query=ctx().sb.from(table);query=patch?query.update(patch):query.delete();const r=await query.eq('id',id).eq('event_id',event.id);if(r.error)throw r.error;await M.loadEventPlaylist();}catch(e){notice(e.message);}}
    if(owner)button(playlist.is_locked?'Déverrouiller les propositions':'Verrouiller les propositions',()=>change('music_playlists',playlist.id,{is_locked:!playlist.is_locked}),controls);
    const title=document.createElement('h3');title.textContent='Ordre de lecture commun';controls.appendChild(title);
    items.forEach((item,index)=>{const row=document.createElement('div');row.className='musicListRow';const name=document.createElement('span');name.textContent=(index+1)+'. '+M.metadata(item.track?.title);row.appendChild(name);button('⋮',()=>menu(item.track),row);
      if(owner){button(item.is_locked?'Déverrouiller':'Verrouiller',()=>change('music_playlist_items',item.id,{is_locked:!item.is_locked}),row);
        button('Supprimer',()=>change('music_playlist_items',item.id,null),row).disabled=!!item.is_locked;
        for(const [label,delta] of [['↑',-1],['↓',1]]){const b=button(label,async()=>{try{const j=index+delta,ids=items.map(x=>x.id);[ids[index],ids[j]]=[ids[j],ids[index]];const r=await ctx().sb.rpc('music_reorder_queue',{target_event:event.id,target_playlist:playlist.id,item_ids:ids});if(r.error)throw r.error;await M.loadEventPlaylist();}catch(e){notice('Réorganisation indisponible : '+e.message);}},row);b.disabled=!!item.is_locked||!items[index+delta]||!!items[index+delta]?.is_locked;}
      }controls.appendChild(row);
    });
    if(items.length)button('Lire cette file',()=>{const tracks=items.map(i=>i.track).filter(Boolean);if(tracks.length){M.openPlayer(tracks[0],tracks);P.play(tracks[0],tracks);}},controls);
  }
  async function participants(){const {sb,event}=ctx();const token=revision;try{const r=await sb.from('event_members').select('user_id').eq('event_id',event.id);if(r.error)throw r.error;const ids=[...new Set([event.creator_id,...(r.data||[]).map(x=>x.user_id)].filter(Boolean))];let profiles=[];if(ids.length){const names=await sb.from('profiles').select('id,display_name').in('id',ids);if(names.error)throw names.error;profiles=names.data||[];}if(token!==revision)return;const p=document.createElement('p');p.dataset.musicParticipants='';p.textContent=ids.length+' participant(s) : '+ids.map(id=>profiles.find(p=>p.id===id)?.display_name||'Participant').join(', ');$('musicScreenBody').querySelector('[data-music-participants]')?.remove();$('musicScreenBody').appendChild(p);}catch(e){if(token===revision)notice('Participants : '+e.message);}}
  window.addEventListener('music-recent-change',()=>{if(screen==='home')renderHome();});
  window.addEventListener('music-artwork-change',()=>{if(screen==='home')renderHome();});
  window.addEventListener('music-user-change',()=>{history=[];results=[];nextPageToken=null;activeQuery='';eventData=null;revision++;page.replaceChildren();page.hidden=true;home.hidden=false;screen='home';for(const id of ['musicFavoritesPanel','musicEventPanel'])$(id)?.remove();M.closePlayer();$('musicTrending').replaceChildren();$('musicSearchInput').value=S.get().query;renderHome();});
  window.addEventListener('music-player-open',()=>{const panel=$('musicPlayer');if(panel&&!panel.querySelector('[data-full-menu]'))button('⋮ Actions du morceau',()=>menu(P.current),panel).dataset.fullMenu='true';});
  window.addEventListener('music-track-change',e=>{if($('musicPlayer')?.classList.contains('open'))M.openPlayer(e.detail);});
  window.addEventListener('music-storage-error',()=>notice('Stockage local indisponible : les changements restent valables pour cette session.'));
  // Contract for a future Selfie integration; it does not change Camera V1.
  M.createSelfieSelection=(track,options={})=>({track,segment:{start:Math.max(0,Number(options.start)||0),duration:[15,30,60].includes(options.duration)?options.duration:Math.max(1,Number(options.duration)||15)},musicVolume:1,originalVolume:1,fadeIn:0,fadeOut:0,renderable:false});
  M.registerRecommendationProvider=adapter=>{M.recommendationProvider=adapter;};
  M.registerProvider('youtube',P);
  home.querySelector('.musicSectionTitle button:not([id])')?.addEventListener('click',()=>{go('discover');search('musique tendances France');});
  home.querySelector('[data-music-action="dj"] small')?.replaceChildren(document.createTextNode('File · Manuel'));
  $('musicProviderStatus').textContent='Recherche YouTube · lecture à la demande';
  window.MyEventMusicWorkspace={go,back};renderHome();$('musicSearchInput').value=S.get().query;
  let eventId=ctx().event?.id;
  setInterval(()=>{const next=ctx().event?.id;if(next===eventId)return;eventId=next;eventData=null;$('musicEventPanel')?.remove();if(screen==='event'&&root.classList.contains('open'))go('event',false);},750);
  document.querySelector('[data-bottom-tab="music"]')?.addEventListener('click',()=>go(S.get().screen,false),true);
})();
