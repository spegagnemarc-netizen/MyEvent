/* MyEvent Music V1 — provider-ready + collaborative event playlist */
(function(){
  const $=id=>document.getElementById(id);
  const home=$('socialHome'),music=$('musicHome'),nav=$('socialBottomNav');
  if(!music||!nav)return;
  const providers=new Map();
  const ctx=()=>window.myeventMusicContext?.()||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  // Decode metadata as text, then escape at HTML boundaries (including saved tracks).
  const decoder=document.createElement('textarea');
  function metadata(value){decoder.innerHTML=String(value??'').replace(/</g,'&lt;');return decoder.value;}
  const meta=value=>esc(metadata(value));
  function status(t){for(const id of ['musicProviderStatus','musicPlayerStatus']){const e=$(id);if(e)e.textContent=t}}
  function closePlayer(){const panel=$('musicPlayer');if(panel){panel.classList.remove('open');panel.replaceChildren();window.dispatchEvent(new CustomEvent('music-player-close'));}}
  async function findTrack(sb,track){
    const r=await sb.from('music_tracks').select('id').eq('provider',track.provider).eq('provider_track_id',track.provider_track_id).maybeSingle();
    if(r.error)throw r.error;return r.data?.id;
  }
  async function ensureTrack(sb,track){
    const existing=await findTrack(sb,track);if(existing)return existing;
    const r=await sb.from('music_tracks').insert({provider:track.provider,provider_track_id:track.provider_track_id,title:track.title,artist:track.artist,thumbnail_url:track.thumbnail_url}).select('id').single();
    if(r.error){if(r.error.code==='23505'){const id=await findTrack(sb,track);if(id)return id;}throw r.error;}
    return r.data.id;
  }
  async function bindFavorite(track,button){
    const {sb,user}=ctx();
    if(!sb||!user){button.disabled=false;button.addEventListener('click',()=>status('Connecte-toi pour enregistrer tes favoris.'));return;}
    let trackId,favorite=false;
    const paint=()=>{button.setAttribute('aria-pressed',String(favorite));button.innerHTML=(favorite?'♥':'♡')+'<span>Favori</span>';};
    async function read(){
      trackId=await findTrack(sb,track);
      if(trackId){const r=await sb.from('music_favorites').select('track_id').eq('user_id',user.id).eq('track_id',trackId).maybeSingle();if(r.error)throw r.error;favorite=!!r.data;}
      paint();
    }
    let ready=false;
    try{await read();ready=true;}catch(e){if(button.isConnected)status('Favoris : '+e.message);}
    button.disabled=false;
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        if(ctx().user?.id!==user.id)throw new Error('Reconnecte-toi puis rouvre le morceau.');
        if(!ready){await read();ready=true;}
        if(!trackId)trackId=await ensureTrack(sb,track);
        const r=favorite?await sb.from('music_favorites').delete().eq('user_id',user.id).eq('track_id',trackId):await sb.from('music_favorites').insert({user_id:user.id,track_id:trackId});
        if(r.error&&!(r.error.code==='23505'&&!favorite))throw r.error;
        favorite=!favorite;paint();
        if(button.isConnected)status(favorite?'Ajouté aux favoris.':'Retiré des favoris.');
        if($('musicFavoritesPanel')?.classList.contains('open'))await loadFavorites();
      }catch(e){if(button.isConnected)status('Favoris : '+e.message);}finally{button.disabled=false;}
    });
  }
  async function loadFavorites(){
    try{
      const {sb,user}=ctx();if(!sb||!user)throw new Error('Connecte-toi pour retrouver tes favoris.');
      const r=await sb.from('music_favorites').select('track:music_tracks(id,provider,provider_track_id,title,artist,thumbnail_url)').eq('user_id',user.id).order('created_at',{ascending:false});
      if(r.error)throw r.error;
      const tracks=(r.data||[]).map(x=>x.track).filter(Boolean);
      let panel=$('musicFavoritesPanel');if(!panel){panel=document.createElement('div');panel.id='musicFavoritesPanel';panel.className='musicEventPanel';music.appendChild(panel);}
      panel.innerHTML='<div class="musicSectionTitle"><h3>Mes favoris</h3><button type="button" data-favorites-close>Fermer</button></div>'+(tracks.length?tracks.map(x=>'<button type="button" class="musicFavoriteRow"><strong>'+meta(x.title)+'</strong><small>'+meta(x.artist)+'</small></button>').join(''):'<div class="musicEmpty">Aucun favori pour le moment.</div>');
      panel.classList.add('open');window.dispatchEvent(new CustomEvent('music-library-loaded'));panel.querySelector('[data-favorites-close]').addEventListener('click',()=>panel.classList.remove('open'));
      bindTrackOpen(panel.querySelectorAll('.musicFavoriteRow'),tracks);
    }catch(e){status('Favoris : '+e.message);}
  }
  async function ensurePlaylist(){
    const {sb,user,event}=ctx(); if(!sb||!user||!event?.id)throw new Error('Ouvre d’abord un événement MyEvent.');
    let r=await sb.from('music_playlists').select('*').eq('event_id',event.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(r.error)throw r.error;
    if(!r.data){r=await sb.from('music_playlists').insert({event_id:event.id,created_by:user.id,name:'Playlist de l’événement'}).select().single();if(r.error)throw r.error;}
    return r.data;
  }
  async function loadEventPlaylist(){
    try{
      const {sb,event}=ctx();const playlist=await ensurePlaylist();
      const r=await sb.from('music_playlist_items').select('id,position,is_locked,created_at,track:music_tracks(id,provider,provider_track_id,title,artist,thumbnail_url),votes:music_votes(value)').eq('event_id',event.id).eq('playlist_id',playlist.id);
      if(r.error)throw r.error;
      const items=(r.data||[]).map(x=>({...x,score:(x.votes||[]).reduce((n,v)=>n+(v.value||0),0)})).sort((a,b)=>(b.score-a.score)||((a.position??9999)-(b.position??9999))||a.created_at.localeCompare(b.created_at));
      renderPlaylist(playlist,items);
    }catch(e){status('Playlist : '+e.message)}
  }
  function bindTrackOpen(rows,tracks){
    rows.forEach((row,i)=>row.addEventListener('click',e=>{
      if(e.target.closest('[data-music-add],[data-music-vote]'))return;
      if(tracks[i])openPlayer(tracks[i],tracks.filter(Boolean));
    }));
  }
  function renderPlaylist(playlist,items){
    let panel=$('musicEventPanel');
    if(!panel){panel=document.createElement('div');panel.id='musicEventPanel';panel.className='musicEventPanel';music.appendChild(panel);}
    panel.innerHTML='<div class="musicSectionTitle"><h3>'+esc(playlist.name)+'</h3><button type="button" id="musicClosePlaylist">Fermer</button></div>'+
      (items.length?items.map((x,i)=>'<div class="musicQueueRow"><b>'+(i+1)+'</b><div><strong>'+meta(x.track?.title||'Morceau')+'</strong><small>'+meta(x.track?.artist||x.track?.provider||'')+'</small></div><button data-music-vote="'+x.id+'">👍 '+x.score+'</button></div>').join(''):'<div class="musicEmpty">Aucun morceau proposé pour cet événement.</div>');
    panel.classList.add('open');
    $('musicClosePlaylist')?.addEventListener('click',()=>panel.classList.remove('open'));
    bindTrackOpen(panel.querySelectorAll('.musicQueueRow'),items.map(x=>x.track));
    panel.querySelectorAll('[data-music-vote]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();vote(b.dataset.musicVote)}));
  }
  function renderSearchResults(items){
    const box=$('musicTrending');if(!box)return;
    box.innerHTML=items.length?items.map(x=>'<article class="musicSearchResult" data-music-open="'+esc(x.provider_track_id)+'"><img src="'+esc(x.thumbnail_url)+'" alt=""><div><strong>'+meta(x.title)+'</strong><small>'+meta(x.artist)+'</small></div><button type="button" data-music-add="'+esc(x.provider_track_id)+'" aria-label="Ajouter à la playlist">＋</button></article>').join(''):'<div class="musicEmpty">Aucun résultat.</div>';
    bindTrackOpen(box.querySelectorAll('[data-music-open]'),items);
    box.querySelectorAll('[data-music-add]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const x=items.find(v=>v.provider_track_id===b.dataset.musicAdd);if(x)addTrackToEvent(x,b)}));
  }
  function openPlayer(track,items=[]){
    let panel=$('musicPlayer');
    if(!panel){panel=document.createElement('section');panel.id='musicPlayer';panel.className='musicPlayer';music.appendChild(panel);}
    window.MyEventMusicPlayback?.select(track,items);
    window.dispatchEvent(new CustomEvent('music-player-open'));
    const id=encodeURIComponent(track.provider_track_id||'');
    panel.innerHTML='<div class="musicPlayerTop"><button type="button" data-player-close aria-label="Retour">‹</button><b>MyEvent · Musique</b><span aria-hidden="true">♫</span></div>'+
      '<div class="musicPlayerMedia"><button type="button" class="musicPlayerCover" data-player-play aria-label="Lire sur YouTube"><img src="'+esc(track.thumbnail_url)+'" alt=""><span>▶<small>Lire sur YouTube</small></span></button></div>'+
      '<div class="musicPlayerMeta"><h2>'+meta(track.title)+'</h2><p>'+meta(track.artist)+'</p></div>'+
      '<div class="musicPlayerActions"><button type="button" data-player-add>＋<span>Playlist</span></button><button type="button" data-player-fav aria-pressed="false" disabled>♡<span>Favori</span></button><button type="button" data-player-share>↗<span>Partager</span></button><button type="button" data-player-related>♫<span>Similaires</span></button></div>'+
      '<p id="musicPlayerStatus" role="status" aria-live="polite"></p>'+
      '<div class="musicPlayerRelated"><div class="musicSectionTitle"><h3>Titres similaires</h3></div><div class="musicCards">'+items.filter(x=>x.provider_track_id!==track.provider_track_id).slice(0,5).map(x=>'<button type="button" class="musicRelatedCard" data-related="'+esc(x.provider_track_id)+'"><img src="'+esc(x.thumbnail_url)+'" alt=""><span><b>'+meta(x.title)+'</b><small>'+meta(x.artist)+'</small></span></button>').join('')+'</div></div>';
    panel.classList.add('open');panel.scrollTop=0;
    panel.querySelector('[data-player-close]')?.addEventListener('click',closePlayer);
    panel.querySelector('[data-player-play]').addEventListener('click',()=>{
      window.MyEventMusicPlayback.play(track,items);
    });
    panel.querySelector('[data-player-add]')?.addEventListener('click',e=>addTrackToEvent(track,e.currentTarget));
    panel.querySelector('[data-player-share]')?.addEventListener('click',async()=>{const url='https://www.youtube.com/watch?v='+track.provider_track_id;try{if(navigator.share)await navigator.share({title:metadata(track.title),text:metadata(track.artist),url});else{await navigator.clipboard.writeText(url);status('Lien copié.')}}catch(e){if(e.name!=='AbortError')status('Partage indisponible : '+e.message)}});
    bindFavorite(track,panel.querySelector('[data-player-fav]'));
    panel.querySelectorAll('[data-related]').forEach(b=>b.addEventListener('click',()=>{const x=items.find(v=>v.provider_track_id===b.dataset.related);if(x)openPlayer(x,items)}));
    panel.querySelector('[data-player-related]')?.addEventListener('click',()=>panel.querySelector('.musicPlayerRelated')?.scrollIntoView({behavior:'smooth'}));
  }
  async function searchMusic(q){
    status('Recherche YouTube…');
    const r=await fetch('/api/search-music?q='+encodeURIComponent(q));const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Recherche indisponible');
    window.MyEventMusicSession?.update({query:q});window.dispatchEvent(new CustomEvent('music-search-results',{detail:data.items||[]}));renderSearchResults(data.items||[]);status((data.items||[]).length+' résultat(s) YouTube');
  }
  async function addTrackToEvent(track,button){
    const original=button?.innerHTML;
    try{
      if(button){button.disabled=true;if(button.querySelector('span'))button.querySelector('span').textContent='Ajout…';else button.textContent='…'}
      const {sb,user,event}=ctx();if(!sb||!user||!event?.id)throw new Error('Ouvre d’abord un événement.');
      const playlist=await ensurePlaylist();
      const trackId=await ensureTrack(sb,track);
      const add=await sb.from('music_playlist_items').insert({playlist_id:playlist.id,event_id:event.id,track_id:trackId,proposed_by:user.id});
      if(add.error){if(add.error.code==='23505')throw new Error('Ce morceau est déjà dans la playlist.');throw add.error;}
      status('Morceau ajouté à la playlist 🎉');if(button){if(button.querySelector('span'))button.querySelector('span').textContent='Ajouté';else button.textContent='✓'}await loadEventPlaylist();
    }catch(e){status('Ajout : '+e.message);if(button){button.disabled=false;button.innerHTML=original}}
  }
  async function vote(itemId){
    try{
      const {sb,user,event}=ctx();if(!sb||!user||!event?.id)throw new Error('Événement non sélectionné.');
      const r=await sb.from('music_votes').upsert({event_id:event.id,playlist_item_id:itemId,user_id:user.id,value:1},{onConflict:'playlist_item_id,user_id'});
      if(r.error)throw r.error;await loadEventPlaylist();
    }catch(e){status('Vote : '+e.message)}
  }
  window.MyEventMusic={
    registerProvider(id,adapter){if(id&&adapter)providers.set(id,adapter);},
    getProvider(id){return providers.get(id)||null;},
    listProviders(){return [...providers.keys()]},
    ensureEventPlaylist:ensurePlaylist,loadEventPlaylist,loadFavorites,openPlayer,closePlayer,searchMusic,addTrackToEvent,bindFavorite,ensureTrack,metadata,escape:esc,openMusic,closeMusic
  };
  function openMusic(){window.MyEventMusicSession?.get();music.classList.add('open');music.setAttribute('aria-hidden','false');document.body.classList.add('musicModeOpen');nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='music'))}
  function closeMusic(){closePlayer();music.classList.remove('open');music.setAttribute('aria-hidden','true');document.body.classList.remove('musicModeOpen');nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='feed'))}
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab="music"]');if(b){e.preventDefault();e.stopImmediatePropagation();openMusic()}},true);
  $('musicBackBtn')?.addEventListener('click',closeMusic);
  document.querySelectorAll('[data-music-filter]').forEach(b=>b.addEventListener('click',()=>document.querySelectorAll('[data-music-filter]').forEach(x=>x.classList.toggle('active',x===b))));
  const searchInput=$('musicSearchInput');
  async function runSearch(){
    const q=searchInput?.value.trim()||'';
    if(q.length<2){status('Écris au moins 2 caractères.');return}
    try{await searchMusic(q)}catch(err){status('Recherche : '+err.message)}
  }
  searchInput?.addEventListener('search',runSearch);
  searchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchInput.blur();runSearch()}});
  $('musicSearchBtn')?.addEventListener('click',runSearch);
  music.querySelectorAll('.musicChips button').forEach(b=>b.addEventListener('click',()=>{if(searchInput)searchInput.value=b.textContent.trim();runSearch()}));
  music.querySelector('[data-music-filter="trends"]')?.addEventListener('click',()=>{if(searchInput)searchInput.value='musique tendances France';runSearch()});
  music.querySelector('[data-music-action="event"]')?.addEventListener('click',loadEventPlaylist);
  $('musicEventPlaylistsBtn')?.addEventListener('click',loadEventPlaylist);
  music.querySelector('[data-music-action="dj"]')?.addEventListener('click',()=>window.MyEventMusicWorkspace?.go('dj'));
  music.querySelector('[data-music-action="favorites"]')?.addEventListener('click',loadFavorites);
})();
