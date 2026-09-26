/* MyEvent — Salon Divertissement & Jeux V1 shell */
(function(){
 const $=id=>document.getElementById(id);
 const lounge=$('entertainmentLounge');
 if(!lounge)return;
 function open(){lounge.classList.add('open');lounge.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
 function close(){lounge.classList.remove('open');lounge.setAttribute('aria-hidden','true');document.body.style.overflow=''}
 $('entertainmentBackBtn')?.addEventListener('click',close);
 $('socialHeaderGamesBtn')?.addEventListener('click',open);
 lounge.addEventListener('click',e=>{
   const game=e.target.closest('[data-entertainment-game]');if(!game)return;
   const key=game.dataset.entertainmentGame;
   if(key==='infiltre'){globalThis.dispatchEvent(new CustomEvent('myevent-open-infiltre'));return}
   const names={quiz:'Quiz',blindtest:'Blind Test',defis:'Défis',action:'Action ou Vérité',likely:'Qui est le plus susceptible de…',karaoke:'Karaoké'};
   const msg=key==='karaoke'?'🎤 Karaoké MyEvent est prévu pour une prochaine version.':(names[key]||'Ce jeu')+' arrive prochainement dans le Salon.';
   alert(msg);
 });
 globalThis.myeventEntertainment={open,close};
})();
