/* MyEvent Music V1 — central module shell, provider-ready */
(function(){
  const $=id=>document.getElementById(id);
  const home=$('socialHome'),music=$('musicHome'),nav=$('socialBottomNav');
  if(!music||!nav)return;
  const providers=new Map();
  window.MyEventMusic={
    registerProvider(id,adapter){if(id&&adapter)providers.set(id,adapter);},
    getProvider(id){return providers.get(id)||null;},
    listProviders(){return [...providers.keys()];}
  };
  function openMusic(){
    if(home)home.style.display='none';
    music.classList.add('open');music.setAttribute('aria-hidden','false');
    nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='music'));
  }
  function closeMusic(){
    music.classList.remove('open');music.setAttribute('aria-hidden','true');
    if(home)home.style.display='';
    nav.querySelectorAll('[data-bottom-tab]').forEach(b=>b.classList.toggle('active',b.dataset.bottomTab==='feed'));
  }
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab="music"]');if(b){e.preventDefault();e.stopImmediatePropagation();openMusic();}},true);
  $('musicBackBtn')?.addEventListener('click',closeMusic);
  document.querySelectorAll('[data-music-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-music-filter]').forEach(x=>x.classList.toggle('active',x===b));}));
  $('musicSearchInput')?.addEventListener('input',e=>{const q=e.target.value.trim();$('musicProviderStatus').textContent=q?'Recherche prête — fournisseur à connecter':'Fournisseur : non connecté';});
  music.querySelector('[data-music-action="event"]')?.addEventListener('click',()=>{$('eventsCard')?.scrollIntoView({behavior:'smooth',block:'start'});closeMusic();});
  music.querySelector('[data-music-action="dj"]')?.addEventListener('click',()=>{$('musicProviderStatus').textContent='Mode DJ : squelette prévu pour la prochaine étape';});
  music.querySelector('[data-music-action="favorites"]')?.addEventListener('click',()=>{$('musicProviderStatus').textContent='Favoris : stockage Supabase prévu';});
})();