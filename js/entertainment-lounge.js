/* MyEvent — Salon Divertissement & Jeux V2 / Infiltré playable */
(function(){
 const $=id=>document.getElementById(id), lounge=$('entertainmentLounge'); if(!lounge)return;
 const words=[['Plage','Mer'],['Chat','Tigre'],['Pizza','Lasagnes'],['Ski','Snowboard'],['Cinéma','Théâtre'],['Café','Chocolat'],['Avion','Hélicoptère'],['Football','Rugby'],['Guitare','Piano'],['Piscine','Lac'],['Camping','Hôtel'],['Mariage','Anniversaire'],['Paris','Londres'],['Pomme','Poire'],['Burger','Tacos'],['Vélo','Trottinette'],['Soleil','Lune'],['Montagne','Colline'],['Chien','Loup'],['Bateau','Voilier']];
 let state={view:'hub',mode:'together',count:6,spy:false,double:false,players:[],roles:[],reveal:0,turn:0,vote:null,round:1,timer:null,left:30};
 const views=()=>[...lounge.querySelectorAll('.entertainmentView')];
 function show(id){views().forEach(v=>v.classList.toggle('active',v.id===id));state.view=id;lounge.scrollTop=0}
 function open(){lounge.classList.add('open');lounge.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';show('entertainmentHub')}
 function close(){clearInterval(state.timer);lounge.classList.remove('open');lounge.setAttribute('aria-hidden','true');document.body.style.overflow=''}
 function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function renderNames(){const box=$('infiltrePlayerNames');if(!box)return;box.innerHTML=Array.from({length:state.count},(_,i)=>'<input maxlength="18" data-player-name="'+i+'" value="'+esc(state.players[i]?.name||('Joueur '+(i+1)))+'" aria-label="Nom joueur '+(i+1)+'">').join('')}
 function syncCount(){state.count=Math.max(4,Math.min(16,state.count));$('infiltrePlayerCount').textContent=state.count;renderNames();$('doubleInfiltreChoice')?.classList.toggle('active',state.double)}
 function startGame(){
  const names=[...lounge.querySelectorAll('[data-player-name]')].map((x,i)=>x.value.trim()||'Joueur '+(i+1));state.players=names.map((name,i)=>({id:i,name,alive:true,votes:0}));
  const pair=words[Math.floor(Math.random()*words.length)], order=[...state.players.keys()].sort(()=>Math.random()-.5);
  let infCount=state.double&&state.count>=7?2:1; state.roles=state.players.map(()=>({type:'citizen',word:pair[0]}));
  order.slice(0,infCount).forEach(i=>state.roles[i]={type:'infiltrator',word:pair[1]});
  if(state.spy&&state.count>=5)state.roles[order[infCount]]={type:'spy',word:''};
  state.reveal=0;state.turn=0;state.vote=null;state.round=1;renderReveal();show('infiltreReveal');
 }
 function renderReveal(){
  const p=state.players[state.reveal],r=state.roles[state.reveal], box=$('infiltreRevealBody'); if(!p||!box)return;
  box.innerHTML='<div class="passPhone"><div class="bigAvatar">👤</div><h3>'+esc(p.name)+'</h3><p>Passe le téléphone à ce joueur.</p><button class="gamePrimary" data-reveal-secret>Voir mon rôle</button></div>';
 }
 function revealSecret(){
  const p=state.players[state.reveal],r=state.roles[state.reveal],box=$('infiltreRevealBody');
  const meta=r.type==='citizen'?['👥','Citoyen','Mot à faire deviner :']:r.type==='infiltrator'?['🕵️','Infiltré','Ton mot différent :']:['🥷','Espion','Tu n’as aucun mot'];
  box.innerHTML='<div class="roleReveal"><div class="secretCard '+r.type+'"><div class="roleIcon">'+meta[0]+'</div><h3>'+meta[1]+'</h3><small>'+meta[2]+'</small>'+(r.word?'<div class="secretWord">'+esc(r.word)+'</div>':'<p>Écoute les indices et essaie de découvrir le thème.</p>')+'</div><button class="gamePrimary" data-hide-secret>Compris !</button></div>';
 }
 function nextReveal(){state.reveal++;if(state.reveal>=state.players.length){startTurns();return}renderReveal()}
 function alive(){return state.players.filter(p=>p.alive)}
 function startTurns(){state.turn=0;renderTurn();show('infiltreTurn')}
 function renderTurn(){
  const a=alive(); if(!a.length)return; if(state.turn>=a.length){renderVote();show('infiltreVote');return}
  const p=a[state.turn],chips=a.map((x,i)=>'<div class="turnChip '+(i===state.turn?'current':'')+'">👤<br>'+esc(x.name)+'</div>').join('');
  $('infiltreTurnBody').innerHTML='<div class="turnTop">'+chips+'</div><div class="turnCenter"><div class="turnAvatar">👤</div><h3>'+esc(p.name)+'</h3><p>Donne un indice sur ton mot sans le prononcer.</p><div class="timer" id="infiltreTimer">00:30</div><div class="timerBar"><i id="infiltreTimerBar"></i></div></div><button class="gamePrimary" data-next-turn>Indice donné ✓</button>';
  startTimer();
 }
 function startTimer(){clearInterval(state.timer);state.left=30;state.timer=setInterval(()=>{state.left--;const el=$('infiltreTimer'),bar=$('infiltreTimerBar');if(el)el.textContent='00:'+String(Math.max(0,state.left)).padStart(2,'0');if(bar)bar.style.width=(Math.max(0,state.left)/30*100)+'%';if(state.left<=0){clearInterval(state.timer);state.turn++;renderTurn()}},1000)}
 function renderVote(){clearInterval(state.timer);state.vote=null;const a=alive();$('infiltreVoteGrid').innerHTML=a.map(p=>'<button class="votePlayer" data-vote="'+p.id+'"><span>👤</span><b>'+esc(p.name)+'</b></button>').join('');$('confirmInfiltreVote').disabled=true}
 function confirmVote(){if(state.vote==null)return;const p=state.players.find(x=>x.id===state.vote);p.alive=false;renderResult(p);show('infiltreResult')}
 function renderResult(p){const r=state.roles[p.id],role=r.type==='citizen'?'Citoyen':r.type==='infiltrator'?'Infiltré':'Espion';$('infiltreResultBody').innerHTML='<div class="resultCard"><div class="resultAvatar">👤</div><h3>'+esc(p.name)+' est éliminé !</h3><div class="resultRole">C’était <b>'+role+'</b>'+(r.word?'<br>Son mot était : <b>'+esc(r.word)+'</b>':'')+'</div></div>';const bad=alive().filter(x=>state.roles[x.id].type!=='citizen').length,cit=alive().filter(x=>state.roles[x.id].type==='citizen').length;const ended=bad===0||bad>=cit;$('infiltreContinue').textContent=ended?'Voir la victoire':'Tour suivant';$('infiltreContinue').dataset.ended=ended?'1':'0'}
 function finishOrContinue(btn){if(btn.dataset.ended==='1'){const bad=alive().filter(x=>state.roles[x.id].type!=='citizen').length;$('infiltreWinner').innerHTML='<div class="resultCard"><div class="resultAvatar">'+(bad?'🕵️':'🎉')+'</div><h3>'+(bad?'Les infiltrés gagnent !':'Les citoyens gagnent !')+'</h3><p>'+state.roles.map((r,i)=>esc(state.players[i].name)+' — '+(r.type==='citizen'?'Citoyen':r.type==='infiltrator'?'Infiltré':'Espion')).join('<br>')+'</p></div>';show('infiltreWin')}else{state.round++;startTurns()}}
 lounge.addEventListener('click',e=>{
  const game=e.target.closest('[data-entertainment-game]');if(game){const k=game.dataset.entertainmentGame;if(k==='infiltre'){show('infiltreIntro');return}alert(k==='karaoke'?'🎤 Karaoké MyEvent est prévu pour une prochaine version.':'Ce jeu arrive prochainement dans le Salon.');return}
  if(e.target.closest('[data-ent-back]')){show(e.target.closest('[data-ent-back]').dataset.entBack);return}
  const mode=e.target.closest('[data-game-mode]');if(mode){state.mode=mode.dataset.gameMode;show('infiltreSetup');return}
  if(e.target.closest('[data-count-minus]')){state.count--;syncCount();return} if(e.target.closest('[data-count-plus]')){state.count++;syncCount();return}
  const role=e.target.closest('[data-role-option]');if(role){const k=role.dataset.roleOption;if(k==='spy')state.spy=!state.spy;if(k==='double')state.double=!state.double;role.classList.toggle('active',k==='spy'?state.spy:state.double);role.querySelector('i').textContent=(k==='spy'?state.spy:state.double)?'✓':'○';return}
  if(e.target.closest('#startInfiltreGame')){startGame();return} if(e.target.closest('[data-reveal-secret]')){revealSecret();return} if(e.target.closest('[data-hide-secret]')){nextReveal();return}
  if(e.target.closest('[data-next-turn]')){clearInterval(state.timer);state.turn++;renderTurn();return}
  const vote=e.target.closest('[data-vote]');if(vote){state.vote=Number(vote.dataset.vote);lounge.querySelectorAll('[data-vote]').forEach(x=>x.classList.toggle('selected',x===vote));$('confirmInfiltreVote').disabled=false;return}
  if(e.target.closest('#confirmInfiltreVote')){confirmVote();return} if(e.target.closest('#infiltreContinue')){finishOrContinue($('infiltreContinue'));return}
  if(e.target.closest('#infiltreReplay')){state.players=[];state.roles=[];renderNames();show('infiltreSetup');return}
  if(e.target.closest('#infiltreVideoCall')){close();const call=$('socialHeaderCallBtn');if(call)call.click();return}
 });
 $('entertainmentBackBtn')?.addEventListener('click',close);$('socialHeaderGamesBtn')?.addEventListener('click',open);
 globalThis.addEventListener('myevent-open-infiltre',()=>show('infiltreIntro'));renderNames();globalThis.myeventEntertainment={open,close};
})();
