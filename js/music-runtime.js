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
  function openMusic(){if(home)home.style.display='none';music.classList.add('open');music.setAttribute('aria-hidden','false');nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='music'))}
  function closeMusic(){music.classList.remove('open');music.setAttribute('aria-hidden','true');if(home)home.style.display='';nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='feed'))}
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab="music"]');if(b){e.preventDefault();e.stopImmediatePropagation();openMusic()}},true);
  $('musicBackBtn')?.addEventListener('click',closeMusic);
  document.querySelectorAll('[data-music-filter]').forEach(b=>b.addEventListener('click',()=>document.querySelectorAll('[data-music-filter]').forEach(x=>x.classList.toggle('active',x===b))));
  $('musicSearchInput')?.addEventListener('input',e=>status(e.target.value.trim()?'Recherche prête — fournisseur à connecter':'Fournisseur : non connecté'));
  music.querySelector('[data-music-action="event"]')?.addEventListener('click',loadEventPlaylist);
  $('musicEventPlaylistsBtn')?.addEventListener('click',loadEventPlaylist);
  music.querySelector('[data-music-action="dj"]')?.addEventListener('click',()=>status('Mode DJ : prochaine étape'));
  music.querySelector('[data-music-action="favorites"]')?.addEventListener('click',()=>status('Favoris : stockage Supabase prêt'));
})();