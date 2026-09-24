/* Shared, user-scoped metadata only. No audio files or automatic playback. */
(function(){
  const defaults=()=>({screen:'home',query:'',current:null,position:0,recent:[],playlists:[],artists:[],draft:[],dj:[],artwork:{},artContext:null});
  let owner, state=defaults();
  function sync(){
    const id=window.myeventMusicContext?.().user?.id||'guest';
    if(id===owner)return state;
    const previous=owner;owner=id;state=defaults();
    try{const saved=JSON.parse(localStorage.getItem('myevent.music.v2.'+id)||'null');if(saved&&typeof saved==='object'){
      for(const key of ['recent','playlists','artists','draft','dj'])if(Array.isArray(saved[key]))state[key]=saved[key].slice(0,100);
      state.artwork=saved.artwork&&typeof saved.artwork==='object'?saved.artwork:{};
      state.artContext=typeof saved.artContext==='string'?saved.artContext:null;
      state.screen=typeof saved.screen==='string'?saved.screen:'home';state.query=typeof saved.query==='string'?saved.query:'';
      state.prompt=typeof saved.prompt==='string'?saved.prompt:'';
      state.current=saved.current?.provider_track_id?saved.current:null;state.position=Math.max(0,Number(saved.position)||0);
    }}catch(e){}
    if(previous!==undefined)window.dispatchEvent(new CustomEvent('music-user-change'));
    return state;
  }
  function save(){try{localStorage.setItem('myevent.music.v2.'+owner,JSON.stringify(state));}catch(e){window.dispatchEvent(new CustomEvent('music-storage-error'));}}
  window.MyEventMusicSession={get:sync,save,update(patch){Object.assign(sync(),patch);save();},key:t=>t.provider+':'+t.provider_track_id};
})();
