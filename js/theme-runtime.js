/* MyEvent global appearance settings. Camera and semantic status colors stay isolated. */
(function(){
  const defaults={mode:'dark',accent:'#ff6a34',buttonOpacity:.90,surfaceOpacity:.94};
  let owner='',theme={...defaults};
  const card=document.getElementById('myeventAppearanceCard');
  const hexToRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',');
  function userKey(){
    const id=window.myeventMusicContext?.().user?.id||window.currentUser?.id||'guest';
    return 'myevent.theme.'+id;
  }
  function normalize(saved){
    const next={...defaults,...(saved||{})};
    if(!/^#[0-9a-f]{6}$/i.test(next.accent))next.accent=defaults.accent;
    if(!['dark','light'].includes(next.mode))next.mode=defaults.mode;
    for(const k of ['buttonOpacity','surfaceOpacity']){
      const n=Number(next[k]);next[k]=Number.isFinite(n)?Math.min(1,Math.max(.2,n)):defaults[k];
    }
    return next;
  }
  function apply(){
    const root=document.documentElement;
    root.dataset.myeventTheme=theme.mode;
    root.style.colorScheme=theme.mode;
    root.style.setProperty('--myevent-accent',theme.accent);
    root.style.setProperty('--myevent-accent-rgb',hexToRgb(theme.accent));
    root.style.setProperty('--myevent-button-opacity',theme.buttonOpacity);
    root.style.setProperty('--myevent-surface-opacity',theme.surfaceOpacity);
    root.style.setProperty('--myevent-accent-global',theme.accent);
    root.style.setProperty('--myevent-accent-rgb-global',hexToRgb(theme.accent));
    root.style.setProperty('--myevent-button-opacity-global',theme.buttonOpacity);
    document.getElementById('socialHome')?.style.setProperty('--social-accent',theme.accent);
    if(!card)return;
    card.querySelectorAll('[data-theme-mode]').forEach(b=>b.classList.toggle('active',b.dataset.themeMode===theme.mode));
    card.querySelectorAll('[data-theme]').forEach(el=>{const k=el.dataset.theme;if(k in theme)el.value=theme[k]});
    card.querySelectorAll('[data-theme-output]').forEach(el=>el.value=Math.round(theme[el.dataset.themeOutput]*100)+'%');
  }
  function read(){
    const key=userKey();if(key===owner)return;
    owner=key;let saved=null;try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
    theme=normalize(saved);apply();
  }
  function save(){try{localStorage.setItem(owner||userKey(),JSON.stringify(theme))}catch(e){}apply()}
  card?.addEventListener('click',e=>{
    const mode=e.target.closest('[data-theme-mode]');if(mode){read();theme.mode=mode.dataset.themeMode;save();return}
    if(e.target.closest('[data-theme-reset]')){read();theme={...defaults};save()}
  });
  card?.addEventListener('input',e=>{
    const k=e.target.dataset.theme;if(!k)return;read();
    theme[k]=k==='accent'?e.target.value:Number(e.target.value);save();
  });
  read();
  window.addEventListener('storage',e=>{if(e.key===owner){owner='';read()}});
  setInterval(read,1000);
})();