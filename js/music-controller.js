/* One provider player attached to body; SPA screens never own its lifetime. */
(function(){
  const session=window.MyEventMusicSession;
  let player=null,ready=false,current=null,queue=[],playing=false,loading=null,generation=0;
  const host=document.createElement('aside');host.id='musicPlayback';host.hidden=true;
  host.innerHTML='<div id="musicVideoHost"><div id="musicVideo"></div></div><div class="musicTransport"><button data-transport="open" aria-label="Ouvrir le lecteur">♫</button><button data-transport="previous" aria-label="Morceau précédent">⏮</button><button data-transport="toggle" aria-label="Lecture ou pause">▶</button><button data-transport="next" aria-label="Morceau suivant">⏭</button><button data-transport="stop" aria-label="Arrêter le lecteur">×</button><input aria-label="Position de lecture" type="range" min="0" max="0" value="0"><small role="status"></small></div>';
  document.body.appendChild(host);
  const message=t=>{host.querySelector('small').textContent=t;};
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
    if(items.length)queue=items;host.hidden=false;host.querySelector('[data-transport="open"]').textContent=window.MyEventMusic?.metadata(track.title)||track.title;return same;
  }
  async function play(track,items=[]){
    if(track)select(track,items);if(!current)return;
    if(current.provider!=='youtube'){message('Lecture non disponible pour ce fournisseur.');return;}
    if(ready){player.playVideo();return;}
    const token=++generation;message('Connexion au lecteur YouTube…');
    try{await api();if(token!==generation)return;
      player?.destroy();host.querySelector('#musicVideoHost').innerHTML='<div id="musicVideo"></div>';
      player=new YT.Player('musicVideo',{host:'https://www.youtube-nocookie.com',width:'100%',height:'200',videoId:current.provider_track_id,playerVars:{playsinline:1,origin:location.origin,start:Math.floor(session.get().position),autoplay:0},events:{
        onReady(e){if(token!==generation)return;ready=true;e.target.playVideo();message('Sur iPhone, touche la vidéo si nécessaire.');},
        onStateChange(e){if(token!==generation)return;playing=e.data===1;host.querySelector('[data-transport="toggle"]').textContent=playing?'⏸':'▶';if(playing){const s=session.get(),k=session.key(current);s.playCounts=s.playCounts&&typeof s.playCounts==='object'?s.playCounts:{};s.playCounts[k]=(Number(s.playCounts[k])||0)+1;s.recent=[current,...s.recent.filter(t=>session.key(t)!==k)].slice(0,100).sort((a,b)=>(Number(s.playCounts[session.key(b)])||0)-(Number(s.playCounts[session.key(a)])||0));
          if(s.artContext&&current.thumbnail_url){s.artwork[s.artContext]={thumbnail_url:current.thumbnail_url,track:current,updated_at:Date.now()};window.dispatchEvent(new CustomEvent('music-artwork-change',{detail:{key:s.artContext,track:current}}));}
          session.save();window.dispatchEvent(new CustomEvent('music-recent-change'));}remember();},
        onError(){message('Cette vidéo ne peut pas être lue ici. Choisis un autre morceau.');},onAutoplayBlocked(){message('Touche Lecture dans la vidéo pour démarrer.');}
      }});
    }catch(e){message(e.message);}
  }
  function step(delta){const index=queue.findIndex(t=>current&&session.key(t)===session.key(current));const next=queue[index+delta];if(next){select(next,queue);play();window.dispatchEvent(new CustomEvent('music-track-change',{detail:next}));}else message('Fin de la file.');}
  function stop(){remember();generation++;player?.destroy();player=null;ready=false;playing=false;current=null;host.hidden=true;host.querySelector('#musicVideoHost').innerHTML='<div id="musicVideo"></div>';}
  host.addEventListener('click',e=>{const action=e.target.closest('[data-transport]')?.dataset.transport;if(action==='open')window.MyEventMusic?.openPlayer(current,queue);if(action==='previous')step(-1);if(action==='next')step(1);if(action==='toggle')playing?player.pauseVideo():play();if(action==='stop')stop();});
  host.querySelector('input').addEventListener('change',e=>{if(ready){player.seekTo(Number(e.target.value),true);remember();}});
  setInterval(()=>{session.get();if(!ready)return;const range=host.querySelector('input');range.max=player.getDuration()||0;range.value=player.getCurrentTime()||0;remember();},1000);
  window.addEventListener('pagehide',remember);
  window.addEventListener('music-user-change',()=>{generation++;player?.destroy();player=null;ready=false;playing=false;current=null;queue=[];host.hidden=true;});
  const camera=document.getElementById('myeventCameraModal');
  if(camera)new MutationObserver(()=>{if(camera.classList.contains('open')){stop();}else if(current)host.hidden=false;}).observe(camera,{attributes:true,attributeFilter:['class']});
  window.MyEventMusicPlayback={select,play,stop,previous:()=>step(-1),next:()=>step(1),get current(){return current;},get playing(){return playing;},capabilities:{youtube:{seek:true,download:false,background:false,mix:false}}};
})();
