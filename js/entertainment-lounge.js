/* Salon Jeux: rendering only. Supabase owns every role, vote, score and transition. */
(() => {
  const root=document.getElementById('entertainmentLounge');if(!root)return;
  const context=()=>window.myeventGameContext?.()||{};
  const session=new window.MyEventGameSession(context);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>root.querySelector('#'+id);
  let screen='hub',shown=false,secretVisible=false,choice=null,busy=false,lastRevision=-1,lastRound=null,account=context().user?.id||null,filter='all',expiredKey='',returnFocus=null,previousOverflow='';
  const modes={classic:'Classique',missions:'Missions',myevent:'MyEvent'};
  const powers={immunity:['🛡️','Immunité','Protège-toi au prochain vote.'],double_vote:['🗳️','Double vote','Ton prochain vote compte double.'],second_clue:['💬','Deuxième indice','Demande un nouvel indice à un autre joueur.'],protection:['🤝','Protection','Protège un autre joueur au prochain vote.'],silence:['🤐','Silence','Un autre joueur ne vote pas au prochain vote.']};
  const games=[['infiltre','🕵️','Infiltré MyEvent','Rôles secrets, indices, votes, bluff…','party'],['defis','🎯','Défis MyEvent','Des missions à vivre ensemble.','party'],['treasure','🗺️','Chasse au trésor','Explorez, trouvez, partagez.','onsite'],['truth','🎭','Action ou Vérité','Les questions qui rapprochent.','party'],['quiz','🧠','Quiz','À vous de faire la différence.','quiz'],['blind','🎵','Blind Test','Une note. Un souvenir. Un titre.','music'],['karaoke','🎤','Karaoké','Chantez vos morceaux préférés.','music']];
  const config={players:6,infiltrators:1,mode:'classic',rounds:3,category:'all'};
  const button=(text,action,extra='',disabled=false,secondary=false)=>`<button type="button" class="${secondary?'gl-secondary':'gl-primary'}" data-action="${action}" ${extra} ${disabled?'disabled':''}>${text}</button>`;
  const person=id=>session.state?.players.find(p=>p.user_id===id);
  const name=id=>esc(person(id)?.name||'Joueur');
  const avatar=p=>`<span class="gl-avatar">${/^https:\/\//i.test(p?.avatar||'')?`<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`:esc(p?.name?.slice(0,1)||'·')}</span>`;
  function notice(text){if($('gl-status'))$('gl-status').textContent=text;}
  function shell(title,body){root.innerHTML=`<div class="gl-shell"><header class="gl-header"><button type="button" class="gl-back" data-action="back" aria-label="Retour">‹</button><h2 tabindex="-1">${title}</h2><span aria-hidden="true">${screen==='hub'?'🏆':'🕵️'}</span></header><p id="gl-status" role="status" aria-live="polite"></p><main>${body}</main><footer class="gl-footer">MYEVENT <span>Jouer, ensemble.</span></footer></div>`;root.scrollTop=0;}
  async function run(fn){if(busy)return;busy=true;root.setAttribute('aria-busy','true');try{await fn();}catch(e){notice(/schema cache|does not exist|Could not find/.test(e.message||'')?'Le Salon Jeux est en cours d’activation. Réessaie un peu plus tard.':e.message||'Connexion interrompue. Réessaie.');}finally{busy=false;root.removeAttribute('aria-busy');}}
  function open(){if(!shown){returnFocus=document.activeElement;previousOverflow=document.body.style.overflow;}shown=true;root.classList.add('open');root.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';if(session.state){screen='room';renderRoom();}else showHub();root.querySelector('h2')?.focus();}
  function close(){shown=false;secretVisible=false;root.classList.remove('open');root.setAttribute('aria-hidden','true');document.body.style.overflow=previousOverflow;returnFocus?.focus();}
  async function loadRooms(){try{const rooms=await session.rpc('game_my_rooms');if(screen==='hub'&&shown&&$('gl-rooms'))$('gl-rooms').innerHTML=rooms.length?`<h3>Retrouver une partie</h3>${rooms.map(r=>button(`${r.invited?'Invitation':'Reprendre'} · ${esc(r.code)}`,'join',`data-code="${esc(r.code)}"`,false,true)).join('')}`:'';}catch(e){if(screen==='hub'&&shown)notice(e.message?.includes('Connexion')?e.message:'Le Salon Jeux est en cours d’activation.');}}
  function showHub(){screen='hub';secretVisible=false;shell('Jeux',`
    <div class="gl-tabs" aria-label="Catégories de jeux">${[['all','Tous'],['party','Soirée'],['onsite','Sur place'],['quiz','Quiz'],['music','Musique']].map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>
    <div class="gl-grid">${games.filter(g=>filter==='all'||filter===g[4]).map(([id,icon,title,description])=>`<button type="button" class="gl-game gl-${id}" data-action="setup" ${id==='infiltre'?'':'disabled'}><span class="gl-game-art" aria-hidden="true">${icon}</span><b>${title}</b><small>${description}</small><span class="gl-badge">${id==='infiltre'?'Jouer':id==='karaoke'?'À venir':'Prochainement'}</span></button>`).join('')}</div>
    <form id="gl-join" class="gl-panel"><label for="gl-code">Tu as un code d’invitation ?</label><div class="gl-inline"><input id="gl-code" name="code" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="Code à 8 caractères" value="${esc(window.myeventInvitations?.get('game')||'')}" required pattern="[A-Za-z0-9]{8}"><button type="submit" class="gl-primary">Rejoindre</button></div></form><div id="gl-rooms"></div>`);loadRooms();}
  function modeHelp(mode){return mode==='classic'?'Mots proches, indices, discussion et vote.':mode==='missions'?'La déduction, avec une mission secrète et des points bonus.':'Le mode signature : déduction, missions secrètes et pouvoirs.';}
  function infiltratorOptions(){return Array.from({length:Math.max(1,Math.floor((config.players-1)/3))},(_,i)=>`<option value="${i+1}" ${config.infiltrators===i+1?'selected':''}>${i+1}</option>`).join('');}
  function showSetup(){screen='setup';const event=context().event;shell('Infiltré MyEvent',`
    <div class="gl-intro"><span class="gl-spy" aria-hidden="true">🕵️</span><div><h3>Un mot. Un doute.</h3><p>La majorité partage un mot. Les infiltrés en ont un autre, très proche. Qui se trahit ?</p></div></div><form id="gl-create">
    <fieldset><legend>Nombre de joueurs maximum</legend><div class="gl-choices">${[4,5,6,7,8,9,10,12].map(n=>`<label><input type="radio" name="players" value="${n}" ${config.players===n?'checked':''}><span>${n}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Mode de jeu</legend><div class="gl-choices">${Object.entries(modes).map(([id,label])=>`<label><input type="radio" name="mode" value="${id}" ${config.mode===id?'checked':''}><span>${label}</span></label>`).join('')}</div><p id="gl-mode-help" class="gl-muted">${modeHelp(config.mode)}</p></fieldset>
    <fieldset><legend>Nombre de manches</legend><div class="gl-choices">${[1,3,5,7].map(n=>`<label><input type="radio" name="rounds" value="${n}" ${config.rounds===n?'checked':''}><span>${n}</span></label>`).join('')}</div></fieldset>
    <label class="gl-field">Thème des mots<select name="category">${[['all','Tous les thèmes'],['general','Général'],['soiree','Soirée'],['voyage','Voyage'],['sport','Sport'],['nourriture','Nourriture'],['animaux','Animaux']].map(([v,l])=>`<option value="${v}" ${config.category===v?'selected':''}>${l}</option>`).join('')}</select></label>
    ${event?.id?`<label class="gl-toggle"><input type="checkbox" name="event"> Dans l’événement « ${esc(event.name||event.title||'en cours')} »</label><p class="gl-muted">Seuls ses participants pourront rejoindre.</p>`:''}
    <details class="gl-panel"><summary>Paramètres avancés</summary><label class="gl-field">Nombre d’infiltrés<select name="infiltrators" id="gl-infiltrators">${infiltratorOptions()}</select></label><p class="gl-muted">Ajusté au groupe présent au lancement : 1 pour 4–6, jusqu’à 2 pour 7–9, jusqu’à 3 pour 10–12.</p>
    <label class="gl-toggle"><input name="missions" type="checkbox" checked> Missions en modes Missions et MyEvent</label><label class="gl-toggle"><input name="powers" type="checkbox" checked> Pouvoirs en mode MyEvent</label>
    <label class="gl-field">Paires personnalisées (facultatif)<textarea name="pairs" rows="3" maxlength="8200" placeholder="Une paire par ligne : mot A / mot B"></textarea></label><p class="gl-muted">Au moins une paire différente par manche. L’auteur connaît les mots proposés, mais pas leur attribution.</p></details>
    <details class="gl-panel"><summary>Les règles, en une minute</summary><p>Chacun découvre son mot et son camp, donne oralement un indice, puis débat. Le vote est secret, définitif et ouvert 90 secondes. Pas de vote pour soi.</p><p>La personne avec le plus de voix est éliminée. En cas d’égalité ou de protection, personne ne sort. Les citoyens gagnent quand tous les infiltrés sont éliminés ; les infiltrés gagnent dès qu’ils sont aussi nombreux que les citoyens.</p><p>Chaque manche redistribue les rôles et les mots. Victoire du camp : +5, infiltré survivant : +2, vote contre un infiltré : +1, mission validée : +2. Les scores ne sont publiés qu’à la fin de la manche.</p><p>Déclare ta mission avant la fin de la manche. L’hôte la valide ensuite (un autre joueur valide celle de l’hôte). Un pouvoir par joueur et par manche, utilisable une fois pendant le débat. Protection et silence durent un vote ; au moins deux joueurs gardent le droit de voter.</p><p>Chacun utilise son compte sur son téléphone. Les indices et la discussion se font oralement, sur place ou dans votre appel habituel.</p></details>
    <button type="submit" class="gl-primary">Créer la partie</button></form>`);}
  function scoreBoard(){const s=session.state;const ranked=s.players.map(p=>({...p,score:s.scores.filter(x=>x.user_id===p.user_id).reduce((a,b)=>a+b.points,0)})).sort((a,b)=>b.score-a.score);return `<div class="gl-panel"><h3>🏆 Classement de la partie</h3>${ranked.map((p,i)=>`<div class="gl-player"><span class="gl-rank">${i+1}</span>${avatar(p)}<b>${esc(p.name)}${p.left_at?' · parti':''}</b><strong>${p.score}<small> pts</small></strong></div>`).join('')}</div>`;}
  function secretCard(s){return `<div class="gl-secret ${s?.role==='infiltrator'?'gl-secret-infiltrator':''}"><small>Ton mot secret</small><strong>${esc(s?.word)}</strong><span class="gl-secret-icon">${s?.role==='infiltrator'?'🕵️':'💡'}</span><h3>${s?.role==='infiltrator'?'Tu es l’infiltré !':'Tu es citoyen.'}</h3><p>${s?.role==='infiltrator'?'Fonds-toi dans le groupe avec des indices crédibles.':'Écoute les indices et repère les différences.'}</p>${s?.mission?`<div class="gl-mission"><b>🎯 Ta mission secrète</b><p>${esc(s.mission)}</p></div>`:''}</div>`;}
  function inviteUrl(){const url=new URL(location.pathname,location.origin);url.searchParams.set('game',session.state.room.code);return url.href;}
  function renderRoom(){
    if(!session.state||!shown||screen!=='room')return;
    const s=session.state,{room:r,round:q,secret}=s,me=person(s.me),host=r.host_id===s.me,active=s.players.filter(p=>!p.left_at),alive=active.filter(p=>p.alive);
    if(lastRound!==r.round_no){secretVisible=false;choice=null;lastRound=r.round_no;}lastRevision=r.revision;
    const phases={reveal:'Ton mot',clues:'Tour de parole',extra_clue:'Deuxième indice',discussion:'Discussion',voting:'Phase de vote',result:'Résultat du vote',round_end:'Résultat de la manche'};
    let body='';const title=r.status==='waiting'?'Salon d’attente':r.status==='finished'?'Classement final':phases[q?.phase]||'La partie';
    if(r.status==='closed'){shell('Salon fermé','<p>Cette partie est terminée.</p>'+button('Retour au Salon Jeux','hub'));return;}
    if(r.status==='waiting'){
      body=`<div class="gl-panel gl-code-panel"><small>Code de la partie</small><div class="gl-room-code">${esc(r.code)}</div>${button('↗ Partager l’invitation','share')}<input id="gl-share-link" readonly aria-label="Lien de la partie" value="${esc(inviteUrl())}"></div><div class="gl-section-label"><h3>Joueurs (${active.length}/${r.settings.players})</h3><span>${esc(modes[r.settings.mode])}</span></div>
      ${active.map(p=>`<div class="gl-player">${avatar(p)}<b>${esc(p.name)} ${p.user_id===r.host_id?'♛':''}${p.user_id===s.me?' · toi':''}<small>${p.user_id===r.host_id?'Hôte':Date.now()-Date.parse(p.last_seen)>60000?'Reconnexion…':'Dans le salon'}</small></b><span class="gl-ready ${p.ready?'yes':''}">${p.ready?'Prêt':'Pas prêt'}</span></div>`).join('')}${Array.from({length:Math.max(0,r.settings.players-active.length)},()=>'<div class="gl-player gl-empty"><span class="gl-avatar">＋</span><span>En attente d’un joueur…</span></div>').join('')}
      ${button(me.ready?'Je ne suis plus prêt':'Je suis prêt','ready',`data-ready="${!me.ready}"`,false,true)}<details class="gl-panel"><summary>${r.event_id?'Inviter des participants':'Inviter mes amis'}</summary><div id="gl-contacts">${button('Afficher les contacts','contacts','',false,true)}</div></details>
      <p class="gl-muted">${r.settings.rounds} manche(s) · ${r.settings.infiltrators} infiltré(s) maximum · 4 joueurs minimum, tous prêts.</p>${host?button('Lancer la partie','start','',active.length<4||active.some(p=>!p.ready)):'<p class="gl-wait">L’hôte lancera la partie quand tout le monde sera prêt.</p>'}`;
    }else if(r.status==='finished'){
      body=`<div class="gl-win"><span>🏆</span><h3>Bien joué, tout le monde.</h3><p>Les mots changent. Les soupçons restent.</p></div>${scoreBoard()}${host?button('Rejouer','replay'):'<p class="gl-wait">L’hôte peut relancer la partie.</p>'}${button('Nouvelle partie','setup','',false,true)}${button('Changer de jeu','hub','',false,true)}`;
    }else if(q){
      body=`<div class="gl-round-label">Manche ${r.round_no}/${r.settings.rounds}<span>Tour ${q.cycle}</span></div>`;
      if(q.phase==='reveal'){
        body+=secretVisible?secretCard(secret):`<div class="gl-secret gl-masked"><span class="gl-secret-icon">🕵️</span><h3>À toi, ${name(s.me)}.</h3><p>Garde ton écran pour toi.</p>${button('Voir mon mot','show-secret')}</div>`;
        body+=me.revealed?'<p class="gl-wait">Tu es prêt. Attendons les autres joueurs…</p>':secretVisible?button('J’ai compris','reveal'):'';
        body+=`<p class="gl-muted gl-center">${active.filter(p=>p.revealed).length}/${active.length} joueurs ont découvert leur mot</p>`;
      }else if(q.phase==='clues'||q.phase==='extra_clue'){
        const speaker=q.phase==='extra_clue'?q.extra_target:q.speaker_order[q.turn_index-1];body+=`<div class="gl-turns">${q.speaker_order.filter(id=>person(id)?.alive&&!person(id)?.left_at).map(id=>`<div class="${id===speaker?'current':''}">${avatar(person(id))}<small>${name(id)}</small></div>`).join('')}</div><div class="gl-turn-center">${avatar(person(speaker))}<h3>C’est à ${name(speaker)} !</h3><p>Donne un indice sur ton mot<br>sans le dire directement.</p><div class="gl-timer" data-deadline="${esc(q.deadline)}"></div></div>${button('Indice donné · passer','advance','',!(host||speaker===s.me||Date.now()>=Date.parse(q.deadline)))}`;
      }else if(q.phase==='discussion'){
        body+='<div class="gl-discussion"><span>💬</span><h3>Qui vous fait douter ?</h3><p>Échangez vos soupçons. Gardez votre mot secret.</p></div>';
        if(secret?.power&&!secret.power_used&&me.alive){const power=powers[secret.power];body+=`<div class="gl-panel"><h3>${power[0]} ${power[1]}</h3><p>${power[2]} Une seule utilisation.</p>${['protection','silence','second_clue'].includes(secret.power)?`<label class="gl-field">Choisir un joueur<select id="gl-power-target">${alive.filter(p=>p.user_id!==s.me).map(p=>`<option value="${p.user_id}">${esc(p.name)}</option>`).join('')}</select></label>`:''}${button('Utiliser mon pouvoir','power','',false,true)}</div>`;}
        body+=host?button('Ouvrir le vote secret','advance'):'<p class="gl-wait">L’hôte ouvrira le vote après la discussion.</p>';
      }else if(q.phase==='voting'){
        body+=`<p class="gl-center">Qui pensez-vous être l’infiltré ?</p><div class="gl-timer small" data-deadline="${esc(q.deadline)}"></div>`;
        if(!me.alive)body+='<p class="gl-wait">Tu es éliminé. Observe la suite de la partie.</p>';
        else if(secret.silence_cycle===q.cycle)body+='<p class="gl-wait">🤐 Silence : tu ne votes pas à ce tour.</p>';
        else if(s.vote)body+='<div class="gl-panel gl-center"><h3>✓ Vote enregistré</h3><p>Ton choix reste secret.</p></div>';
        else body+=`<form id="gl-vote"><fieldset><legend class="gl-sr-only">Choisis un joueur</legend>${alive.filter(p=>p.user_id!==s.me).map(p=>`<label class="gl-vote-player">${avatar(p)}<b>${esc(p.name)}</b><input type="radio" name="target" value="${p.user_id}" ${choice===p.user_id?'checked':''} required></label>`).join('')}</fieldset><button type="submit" class="gl-primary" ${Date.now()>=Date.parse(q.deadline)?'disabled':''}>Valider mon vote</button><p class="gl-muted">Ton vote est définitif.</p></form>`;
        if(Date.now()>=Date.parse(q.deadline))body+=button('Afficher le résultat','advance');
      }else if(q.phase==='result'||q.phase==='round_end'){
        const result=q.result;body+=`<div class="gl-result">${result.eliminated?`${avatar(person(result.eliminated))}<h3>${name(result.eliminated)}<br>quitte la manche !</h3><div class="gl-role-label">${result.role==='infiltrator'?'🕵️ Infiltré':'👥 Citoyen'}</div>`:`<span class="gl-result-icon">${result.protected?'🛡️':'🤝'}</span><h3>${result.protected?'Le joueur est protégé !':q.phase==='round_end'?'Fin de la manche':'Égalité : personne ne sort.'}</h3>`}</div>`;
        if(q.phase==='round_end'){
          body+=`<h3 class="gl-center">${result.winner==='citizen'?'🎉 Les citoyens gagnent !':'🕵️ Les infiltrés gagnent !'}</h3><details class="gl-panel"><summary>Voir les rôles et les mots</summary>${(result.roles||[]).map(role=>`<div class="gl-role-row"><b>${name(role.user_id)}</b><span>${role.role==='infiltrator'?'Infiltré':'Citoyen'} · ${esc(role.word)}</span>${role.mission?`<small>${esc(role.mission)} ${role.mission_claimed?'— réussite déclarée':''}</small>`:''}${role.mission_claimed&&role.user_id!==s.me&&(host||role.user_id===r.host_id)&&!s.scores.some(x=>x.round_no===r.round_no&&x.user_id===role.user_id&&x.reason==='mission')?button('Valider la mission (+2)','approve_mission',`data-target="${role.user_id}"`,false,true):''}</div>`).join('')}</details>${scoreBoard()}`;
          body+=host?button(r.round_no>=r.settings.rounds||active.length<4?'Terminer · classement final':'Prochaine manche','advance'):'<p class="gl-wait">En attente de l’hôte.</p>';
        }else body+=host?button('Tour suivant','advance'):'<p class="gl-wait">En attente de l’hôte.</p>';
      }
      if(me.alive&&!['reveal','round_end','result'].includes(q.phase))body+=`<details class="gl-panel gl-private"><summary>Mon mot et ma mission</summary>${secretCard(secret)}${secret?.mission&&!secret.mission_claimed?button('Mission accomplie · à faire valider','claim_mission','',false,true):secret?.mission_claimed?'<p>✓ Réussite déclarée. Validation après la manche.</p>':''}</details>`;
    }
    const hostPlayer=person(r.host_id);if(!host&&hostPlayer&&Date.now()-Date.parse(hostPlayer.last_seen)>120000)body+=button('Reprendre le rôle d’hôte','claim_host','',false,true);
    if(host&&['waiting','playing'].includes(r.status))body+=active.filter(p=>p.user_id!==s.me&&Date.now()-Date.parse(p.last_seen)>120000).map(p=>button(`Retirer ${esc(p.name)} (absent)`,'remove_absent',`data-target="${p.user_id}"`,false,true)).join('');
    body+='<div class="gl-room-footer"><span id="gl-connection">Synchronisé</span><button type="button" data-action="refresh">Actualiser</button><button type="button" data-action="leave">Quitter la partie</button></div>';
    shell(title,body);tick();
  }
  function tick(){if(!shown||screen!=='room')return;const el=root.querySelector('[data-deadline]');if(!el)return;const left=Math.max(0,Math.ceil((Date.parse(el.dataset.deadline)-Date.now())/1000));el.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;if(!left&&expiredKey!==el.dataset.deadline){expiredKey=el.dataset.deadline;renderRoom();}}
  root.addEventListener('click',e=>{
    const tab=e.target.closest('[data-filter]');if(tab){filter=tab.dataset.filter;showHub();return;}
    const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
    if(action==='back'){if(screen==='hub')close();else showHub();return;}if(action==='hub'){showHub();return;}if(action==='setup'){showSetup();return;}if(action==='show-secret'){secretVisible=true;renderRoom();return;}
    run(async()=>{
      if(action==='join'){await session.join(b.dataset.code);screen='room';renderRoom();}
      else if(action==='share'){const url=inviteUrl();if(navigator.share){try{await navigator.share({title:'Infiltré MyEvent',text:'Rejoins notre partie !',url});}catch(e){if(e.name!=='AbortError')throw e;}}else if(navigator.clipboard){await navigator.clipboard.writeText(url);notice('Lien copié.');}else{$('gl-share-link').select();notice('Copie le lien affiché.');}}
      else if(action==='contacts'){const contacts=await session.rpc('game_contacts',{target_room:session.roomId});$('gl-contacts').innerHTML=contacts.length?contacts.map(p=>button(`Inviter ${esc(p.name)}`,'invite',`data-target="${p.id}"`,false,true)).join(''):'<p>Aucun contact à inviter. Tu peux partager le code.</p>';}
      else if(action==='invite'){await session.act('invite',{target:b.dataset.target});notice('Invitation disponible dans le Salon Jeux de ton contact.');}
      else if(action==='leave'){if(confirm('Quitter cette partie ? Pendant une manche, ton départ est définitif.')){await session.leave();showHub();}}
      else if(action==='refresh'){await session.refresh();renderRoom();}
      else {const data=action==='ready'?{ready:b.dataset.ready==='true'}:action==='power'?{target:$('gl-power-target')?.value||session.state.me}:b.dataset.target?{target:b.dataset.target}:{};if(action==='reveal')secretVisible=false;await session.act(action,data);}
    });
  });
  root.addEventListener('change',e=>{if(e.target.name==='target')choice=e.target.value;if(screen==='setup'){if(e.target.name==='players'){config.players=Number(e.target.value);config.infiltrators=Math.min(config.infiltrators,Math.floor((config.players-1)/3));$('gl-infiltrators').innerHTML=infiltratorOptions();}if(e.target.name==='mode'){config.mode=e.target.value;$('gl-mode-help').textContent=modeHelp(config.mode);}if(e.target.name==='rounds')config.rounds=Number(e.target.value);if(e.target.name==='category')config.category=e.target.value;if(e.target.name==='infiltrators')config.infiltrators=Number(e.target.value);}});
  root.addEventListener('submit',e=>{e.preventDefault();const form=e.target,data=new FormData(form);run(async()=>{
    if(form.id==='gl-join'){await session.join(String(data.get('code')).trim());screen='room';renderRoom();}
    if(form.id==='gl-create'){const pairs=String(data.get('pairs')||'').split('\n').filter(x=>x.trim()).map(line=>line.split('/').map(x=>x.trim()));if(pairs.some(x=>x.length!==2||x.some(w=>!w||w.length>40)))throw Error('Une paire par ligne, sous la forme mot A / mot B.');await session.create({...config,pairs,missions:data.has('missions'),powers:data.has('powers')},data.has('event')?context().event?.id:null);screen='room';renderRoom();}
    if(form.id==='gl-vote')await session.act('vote',{target:data.get('target')});
  });});
  session.addEventListener('state',e=>{if(e.detail.room.revision!==lastRevision&&screen==='room')renderRoom();});
  session.addEventListener('error',e=>{if(shown)notice(e.detail.message||'Connexion interrompue. Actualise pour réessayer.');});
  session.addEventListener('connection',e=>{if($('gl-connection'))$('gl-connection').textContent=e.detail==='live'?'En direct':'Actualisation automatique';});
  document.getElementById('socialHeaderGamesBtn')?.addEventListener('click',open);
  window.addEventListener('myevent-open-infiltre',()=>{open();showSetup();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){secretVisible=false;root.querySelectorAll('.gl-private').forEach(x=>x.open=false);if(screen==='room'&&session.state?.round?.phase==='reveal')renderRoom();}else session.refresh();});
  root.addEventListener('keydown',e=>{
    if(e.key==='Escape')close();
    if(e.key==='Tab'){
      const focusable=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&(document.activeElement===first||!focusable.includes(document.activeElement))){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });setInterval(tick,1000);
  setInterval(()=>{const id=context().user?.id||null;if(id===account)return;account=id;session.disconnect();lastRevision=-1;lastRound=null;secretVisible=false;choice=null;if(shown)showHub();if(id&&window.myeventInvitations?.get('game')){open();notice('Une invitation t’attend. Appuie sur Rejoindre.');}},1000);
  if(account&&window.myeventInvitations?.get('game'))open();
  window.myeventEntertainment={open,close};
})();
