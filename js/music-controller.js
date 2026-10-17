/* One provider player attached to body; SPA screens never own its lifetime. */
(function(){
  const session=window.MyEventMusicSession;
  let player=null,ready=false,current=null,queue=[],playing=false,loading=null,generation=0,shufflePlayed=new Set(),previousTracks=[];
  const host=document.createElement('aside');host.id='musicPlayback';host.hidden=true;
  host.innerHTML='<div id="musicVideoHost"><div id="musicVideo"></div></div><div class="musicTransport"><button data-transport="open" aria-label="Ouvrir le lecteur"><img data-mini-cover alt=""><span><b data-mini-title>Musique</b><small data-mini-artist></small></span></button><button data-transport="previous" aria-label="Morceau précédent">⏮</button><button data-transport="toggle" aria-label="Lecture ou pause">▶</button><button data-transport="next" aria-label="Morceau suivant">⏭</button><button data-transport="stop" aria-label="Arrêter le lecteur">×</button><input aria-label="Position de lecture" type="range" min="0" max="0" value="0"><time data-mini-time>0:00 / 0:00</time><small role="status"></small></div>';
  document.body.appendChild(host);
  const message=t=>{host.querySelector('[role="status"]').textContent=t;};
  function api(){
    if(window.YT?.Player)return Promise.resolve();
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{loading=null;reject(new Error('YouTube indisponible. Réessaie.'));},15000);
      const old=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);old?.();resolve();};
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timeout);loading=null;reject(new Error('Connexion YouTube impossible.'));};document.head.appendChild(script);
    });return loading;
  }
  function remember(){const s=session.get();if(!current)return;session.update({current,position:ready?player.getCurrentTime()||0:s.position});}
  function select(track,items=[]){
    session.get();const same=current&&session.key(current)===session.key(track);
    if(!same){const saved=session.get();const resume=!current&&saved.current&&session.key(saved.current)===session.key(track)?saved.position:0;ready&&player.pauseVideo();current=track;playing=false;session.update({current:track,position:resume});if(ready)player.cueVideoById({videoId:track.provider_track_id,startSeconds:resume});}
    if(items.length)setQueue(items);else if(!queue.length)queue=session.get().playbackQueue||[];host.hidden=false;const cover=host.querySelector('[data-mini-cover]');cover.src=track.thumbnail_url||'';cover.hidden=!track.thumbnail_url;host.querySelector('[data-mini-title]').textContent=window.MyEventMusic?.metadata(track.title)||track.title;host.querySelector('[data-mini-artist]').textContent=window.MyEventMusic?.metadata(track.artist)||track.artist||'';return same;
  }
  async function play(track,items=[]){
    if(track)select(track,items);if(!current)return;
    if(current.provider!=='youtube'){message('Lecture non disponible pour ce fournisseur.');return;}
    if(ready){player.playVideo();return;}
    const token=++generation;message('Connexion au lecteur YouTube…');
    try{await api();if(token!==generation)return;
      player?.destroy();host.querySelector('#musicVideoHost').innerHTML='<div id="musicVideo"></div>';
      player=new YT.Player('musicVideo',{host:'https://www.youtube-nocookie.com',width:'100%',height:'200',videoId:current.provider_track_id,playerVars:{playsinline:1,origin:location.origin,start:Math.floor(session.get().position),autoplay:0},events:{
        onReady(e){if(token!==generation)return;ready=true;e.target.setVolume?.(session.get().playbackSettings.volume);e.target.playVideo();message('Sur iPhone, touche la vidéo si nécessaire.');},
        onStateChange(e){if(token!==generation)return;if(e.data===0){playing=false;host.querySelector('[data-transport="toggle"]').textContent='▶';window.dispatchEvent(new CustomEvent('music-playback-change'));remember();if(session.get().playbackSettings.autoAdvance)step(1,true);else message('Morceau terminé.');return;}playing=e.data===1;if(playing)window.dispatchEvent(new CustomEvent('myevent-music-playback-state',{detail:{state:'playing'}}));host.querySelector('[data-transport="toggle"]').textContent=playing?'⏸':'▶';window.dispatchEvent(new CustomEvent('music-playback-change'));if(playing){const s=session.get(),k=session.key(current);s.playCounts=s.playCounts&&typeof s.playCounts==='object'?s.playCounts:{};s.playCounts[k]=(Number(s.playCounts[k])||0)+1;s.recent=[current,...s.recent.filter(t=>session.key(t)!==k)].slice(0,100).sort((a,b)=>(Number(s.playCounts[session.key(b)])||0)-(Number(s.playCounts[session.key(a)])||0));
          if(s.artContext&&current.thumbnail_url){s.artwork[s.artContext]={thumbnail_url:current.thumbnail_url,track:current,updated_at:Date.now()};window.dispatchEvent(new CustomEvent('music-artwork-change',{detail:{key:s.artContext,track:current}}));}
          session.save();window.dispatchEvent(new CustomEvent('music-recent-change'));}remember();},
        onError(){message('Cette vidéo ne peut pas être lue ici. Choisis un autre morceau.');window.dispatchEvent(new CustomEvent('myevent-music-playback-state',{detail:{state:'error'}}));},onAutoplayBlocked(){message('Touche Lecture dans la vidéo pour démarrer.');window.dispatchEvent(new CustomEvent('myevent-music-playback-state',{detail:{state:'blocked'}}));}
      }});
    }catch(e){message(e.message);}
  }
  function setQueue(items){
    if(items.length===queue.length&&items.every((t,i)=>session.key(t)===session.key(queue[i])))return;
    const seen=new Set();queue=items.filter(t=>t?.provider_track_id&&!seen.has(session.key(t))&&seen.add(session.key(t))).map(t=>({...t}));
    session.update({playbackQueue:queue});shufflePlayed=new Set(current?[session.key(current)]:[]);previousTracks=[];
  }
  function settings(patch){const previous=session.get().playbackSettings;
    const next={...previous,...patch};next.repeat=['off','all','one'].includes(next.repeat)?next.repeat:'off';next.volume=Math.max(0,Math.min(100,Number(next.volume)||0));next.shuffle=!!next.shuffle;next.autoAdvance=!!next.autoAdvance;
    session.update({playbackSettings:next});if(ready)player.setVolume?.(next.volume);window.dispatchEvent(new CustomEvent('music-playback-change'));return next;
  }
  function step(delta,automatic=false){
    if(!current||!queue.length)return;const options=session.get().playbackSettings;
    if(automatic&&options.repeat==='one'){seekTo(0);player.playVideo();return;}
    const index=queue.findIndex(t=>session.key(current)===session.key(t));let next;
    if(options.shuffle){
      if(delta<0){const key=previousTracks.pop();next=queue.find(t=>session.key(t)===key);}
      else{shufflePlayed.add(session.key(current));let available=queue.filter(t=>!shufflePlayed.has(session.key(t)));
        if(!available.length&&options.repeat==='all'){shufflePlayed.clear();available=queue.filter(t=>queue.length===1||session.key(t)!==session.key(current));}
        next=available[Math.floor(Math.random()*available.length)];if(next)previousTracks.push(session.key(current));
      }
    }else{let target=index+delta;if(options.repeat==='all')target=(target+queue.length)%queue.length;next=queue[target];}
    if(next){const same=session.key(next)===session.key(current);select(next);if(same)seekTo(0);play();window.dispatchEvent(new CustomEvent('music-track-change',{detail:next}));}
    else{host.querySelector('[data-transport="toggle"]').textContent='▶';message(delta<0?'Début de la file.':'Fin de la file.');window.dispatchEvent(new CustomEvent('music-playback-change'));}
  }
  function toggle(){if(playing&&ready)player.pauseVideo();else play();}
  function seekTo(seconds){const position=Math.max(0,Number(seconds)||0);session.update({position});if(ready&&player){player.seekTo(position,true);return true;}return false;}
  function stop(){remember();generation++;player?.destroy();player=null;ready=false;playing=false;current=null;host.hidden=true;host.querySelector('#musicVideoHost').innerHTML='<div id="musicVideo"></div>';}
  host.addEventListener('click',e=>{const action=e.target.closest('[data-transport]')?.dataset.transport;if(action==='open')window.MyEventMusic?.openPlayer(current,queue);if(action==='previous')step(-1);if(action==='next')step(1);if(action==='toggle')toggle();if(action==='stop')stop();});
  host.querySelector('input').addEventListener('change',e=>{if(ready){player.seekTo(Number(e.target.value),true);remember();}});
  const clock=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};setInterval(()=>{session.get();if(!ready)return;const range=host.querySelector('input'),duration=player.getDuration()||0,currentTime=player.getCurrentTime()||0;range.max=duration;range.value=currentTime;host.querySelector('[data-mini-time]').textContent=clock(currentTime)+' / '+clock(duration);remember();},1000);
  window.addEventListener('pagehide',remember);
  window.addEventListener('music-user-change',()=>{generation++;player?.destroy();player=null;ready=false;playing=false;current=null;queue=[];shufflePlayed.clear();previousTracks=[];host.hidden=true;});
  const camera=document.getElementById('myeventCameraModal');
  if(camera)new MutationObserver(()=>{if(camera.classList.contains('open')){stop();}else if(current)host.hidden=false;}).observe(camera,{attributes:true,attributeFilter:['class']});
  window.MyEventMusicPlayback={select,play,seekTo,stop,toggle,setQueue,settings,get queue(){return queue;},previous:()=>step(-1),next:()=>step(1),get current(){return current;},get playing(){return playing;},capabilities:{youtube:{seek:true,download:false,background:false,mix:false}}};
})();
