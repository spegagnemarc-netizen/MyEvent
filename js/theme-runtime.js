/* Global tokens adopted incrementally. Camera and semantic colors are untouched. */
(function(){
  const defaults={accent:'#ff6a34',intensity:.18,opacity:.94};let owner,theme={...defaults};
  const card=document.getElementById('myeventAppearanceCard');if(!card)return;
  const controls=document.createElement('div');controls.className='myeventThemeControls';
  controls.innerHTML='<label>Couleur MyEvent<input type="color" data-theme="accent"></label><label>Intensité<input type="range" min="0" max="0.6" step="0.01" data-theme="intensity"></label><label>Opacité des surfaces<input type="range" min="0.7" max="1" step="0.01" data-theme="opacity"></label><button type="button" data-theme-reset>Réinitialiser le thème</button><p>Préférences conservées par compte sur cet appareil. Application progressive à Accueil et Music.</p>';
  card.appendChild(controls);
  function apply(){const root=document.documentElement;root.style.setProperty('--myevent-accent',theme.accent);root.style.setProperty('--myevent-accent-rgb',[1,3,5].map(i=>parseInt(theme.accent.slice(i,i+2),16)).join(','));root.style.setProperty('--myevent-intensity',theme.intensity);root.style.setProperty('--myevent-surface-opacity',theme.opacity);document.getElementById('socialHome')?.style.setProperty('--social-accent',theme.accent);controls.querySelectorAll('[data-theme]').forEach(e=>e.value=theme[e.dataset.theme]);}
  function read(){const id=window.myeventMusicContext?.().user?.id||'guest';if(id===owner)return;owner=id;theme={...defaults};try{const saved=JSON.parse(localStorage.getItem('myevent.theme.'+id)||'null');if(saved){if(/^#[0-9a-f]{6}$/i.test(saved.accent))theme.accent=saved.accent;for(const [key,min,max] of [['intensity',0,.6],['opacity',.7,1]])if(Number.isFinite(saved[key]))theme[key]=Math.min(max,Math.max(min,saved[key]));}}catch(e){}apply();}
  function save(){try{localStorage.setItem('myevent.theme.'+owner,JSON.stringify(theme));}catch(e){controls.querySelector('p').textContent='Stockage indisponible : thème appliqué pour cette session.';}apply();}
  controls.addEventListener('input',e=>{read();const key=e.target.dataset.theme;if(!key)return;theme[key]=key==='accent'?e.target.value:Number(e.target.value);save();});
  controls.querySelector('[data-theme-reset]').onclick=()=>{read();theme={...defaults};save();};
  card.querySelectorAll('[data-accent]').forEach(b=>b.addEventListener('click',()=>{read();theme.accent=b.dataset.accent;save();}));
  card.querySelectorAll('[data-home-bg]').forEach(b=>b.addEventListener('click',()=>{read();apply();}));
  read();setInterval(read,1000);
})();
