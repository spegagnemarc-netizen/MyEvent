/* MyEvent Music V1 — provider-ready + collaborative event playlist */
(function(){
  const $=id=>document.getElementById(id);
  const home=$('socialHome'),music=$('musicHome'),nav=$('socialBottomNav');
  if(!music||!nav)return;
  const providers=new Map();
  const ctx=()=>window.myeventMusicContext?.()||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function status(t){const e=$('musicProviderStatus');if(e)e.textContent=t}
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
  function renderPlaylist(playlist,items){
    let panel=$('musicEventPanel');
    if(!panel){panel=document.createElement('div');panel.id='musicEventPanel';panel.className='musicEventPanel';music.appendChild(panel);}
    panel.innerHTML='<div class="musicSectionTitle"><h3>'+esc(playlist.name)+'</h3><button type="button" id="musicClosePlaylist">Fermer</button></div>'+
      (items.length?items.map((x,i)=>'<div class="musicQueueRow"><b>'+(i+1)+'</b><div><strong>'+esc(x.track?.title||'Morceau')+'</strong><small>'+esc(x.track?.artist||x.track?.provider||'')+'</small></div><button data-music-vote="'+x.id+'">👍 '+x.score+'</button></div>').join(''):'<div class="musicEmpty">Aucun morceau proposé pour cet événement.</div>');
    panel.classList.add('open');
    $('musicClosePlaylist')?.addEventListener('click',()=>panel.classList.remove('open'));
    panel.querySelectorAll('[data-music-vote]').forEach(b=>b.addEventListener('click',()=>vote(b.dataset.musicVote)));
  }
  function renderSearchResults(items){
    const box=$('musicTrending');if(!box)return;
    box.innerHTML=items.length?items.map(x=>'<div class="musicSearchResult"><img src="'+esc(x.thumbnail_url)+'" alt=""><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.artist)+'</small></div><button type="button" data-music-add="'+esc(x.provider_track_id)+'">＋</button></div>').join(''):'<div class="musicEmpty">Aucun résultat.</div>';
    box.querySelectorAll('[data-music-add]').forEach(b=>b.addEventListener('click',()=>{const x=items.find(v=>v.provider_track_id===b.dataset.musicAdd);if(x)addTrackToEvent(x,b)}));
  }
  async function searchMusic(q){
    status('Recherche YouTube…');
    const r=await fetch('/api/search-music?q='+encodeURIComponent(q));const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Recherche indisponible');
    renderSearchResults(data.items||[]);status((data.items||[]).length+' résultat(s) YouTube');
  }
  async function addTrackToEvent(track,button){
    try{
      if(button){button.disabled=true;button.textContent='…'}
      const {sb,user,event}=ctx();if(!sb||!user||!event?.id)throw new Error('Ouvre d’abord un événement.');
      const playlist=await ensurePlaylist();
      let tr=await sb.from('music_tracks').select('id').eq('provider',track.provider).eq('provider_track_id',track.provider_track_id).maybeSingle();
      if(tr.error)throw tr.error;
      let trackId=tr.data?.id;
      if(!trackId){const ins=await sb.from('music_tracks').insert(track).select('id').single();if(ins.error)throw ins.error;trackId=ins.data.id;}
      const add=await sb.from('music_playlist_items').insert({playlist_id:playlist.id,event_id:event.id,track_id:trackId,proposed_by:user.id});
      if(add.error){if(add.error.code==='23505')throw new Error('Ce morceau est déjà dans la playlist.');throw add.error;}
      status('Morceau ajouté à la playlist 🎉');if(button){button.textContent='✓'}await loadEventPlaylist();
    }catch(e){status('Ajout : '+e.message);if(button){button.disabled=false;button.textContent='＋'}}
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
    ensureEventPlaylist:ensurePlaylist,loadEventPlaylist
  };
  function openMusic(){music.classList.add('open');music.setAttribute('aria-hidden','false');document.body.classList.add('musicModeOpen');nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='music'))}
  function closeMusic(){music.classList.remove('open');music.setAttribute('aria-hidden','true');document.body.classList.remove('musicModeOpen');nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='feed'))}
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab="music"]');if(b){e.preventDefault();e.stopImmediatePropagation();openMusic()}},true);
  $('musicBackBtn')?.addEventListener('click',closeMusic);
  document.querySelectorAll('[data-music-filter]').forEach(b=>b.addEventListener('click',()=>document.querySelectorAll('[data-music-filter]').forEach(x=>x.classList.toggle('active',x===b))));
  let searchTimer=null;
  $('musicSearchInput')?.addEventListener('input',e=>{clearTimeout(searchTimer);const q=e.target.value.trim();if(q.length<2){status('Fournisseur : YouTube');return}searchTimer=setTimeout(()=>searchMusic(q).catch(err=>status(err.message)),450)});
  music.querySelector('[data-music-action="event"]')?.addEventListener('click',loadEventPlaylist);
  $('musicEventPlaylistsBtn')?.addEventListener('click',loadEventPlaylist);
  music.querySelector('[data-music-action="dj"]')?.addEventListener('click',()=>status('Mode DJ : prochaine étape'));
  music.querySelector('[data-music-action="favorites"]')?.addEventListener('click',()=>status('Favoris : stockage Supabase prêt'));
})();