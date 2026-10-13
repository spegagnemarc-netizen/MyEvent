/* Additional games share the existing authenticated multiplayer transport and lounge UI. */
(() => {
  const catalogue={truth:['🎭','Action ou Vérité'],treasure:['🗺️','Chasse au trésor'],quiz:['🧠','Quiz'],blind:['🎵','Blind Test']};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let root,context,session,key,onBack,busy=false,screen='setup',lastRevision=-1,lastView='',account;
  const button=(label,action,extra='',disabled=false)=>`<button type="button" class="gl-secondary" data-extra-action="${action}" ${extra} ${disabled?'disabled':''}>${label}</button>`;
  function message(text){const el=root?.querySelector('#extra-status');if(el)el.textContent=text;}
  function shell(body){
    root.dataset.gameScreen='extra-'+key;
    root.innerHTML=`<div class="gl-shell"><header class="gl-header">${button('‹','back','aria-label="Retour aux jeux"')}<h2 tabindex="-1">${catalogue[key][1]}</h2><span aria-hidden="true">${catalogue[key][0]}</span></header><p id="extra-status" role="status" aria-live="polite"></p><main>${body}</main><footer class="gl-footer">ORÉVAMI <span>Jouer, ensemble.</span></footer></div>`;
    root.querySelector('.gl-shell').prepend(window.MyEventSectionNavigation?.header('games')||document.createTextNode(''));
    window.MyEventSectionNavigation?.visit('games','extra-'+key);
  }
  async function run(fn){if(busy)return;busy=true;root.setAttribute('aria-busy','true');try{await fn();}catch(e){message(/schema cache|does not exist|Could not find/.test(e.message||'')?'Ce jeu nécessite l’activation des RPC dans Supabase TEST.':e.message||'Connexion interrompue. Réessaie.');}finally{busy=false;root?.removeAttribute('aria-busy');}}
  function row(){return `<fieldset class="gl-panel extra-item"><legend>${key==='treasure'?'Étape':'Extrait'}</legend><label class="gl-field">${key==='treasure'?'Indice à résoudre':'Question'}<textarea name="prompt" required maxlength="${key==='treasure'?500:400}" rows="2"></textarea></label>${key==='treasure'?'<label class="gl-field">Code-réponse secret<input name="answer" required maxlength="100" autocomplete="off"></label>':`<label class="gl-field">Lien HTTPS direct de l’extrait audio<input name="audio_url" type="url" required maxlength="1500" placeholder="https://…/extrait.mp3"></label>${[0,1,2,3].map(i=>`<label class="gl-field">Choix ${i+1}<input name="choice${i}" maxlength="150" required></label>`).join('')}<label class="gl-field">Bonne réponse<select name="answer">${[0,1,2,3].map(i=>`<option value="${i}">Choix ${i+1}</option>`).join('')}</select></label>`}${button('Supprimer cette étape','remove-item')}</fieldset>`;}
  function setup(){
    screen='setup';lastRevision=-1;
    const event=context().event;
    const rules={truth:'À tour de rôle, choisis une vérité ou une action. Réalisez-la ensemble, puis valide ou passe sans pénalité. Participation : +1 point. Deux joueurs minimum.',quiz:'Cinq questions, quatre choix. Chacun répond sur son téléphone en 60 secondes. L’hôte révèle quand tous ont répondu ou à la fin du délai. Bonne réponse : +1 point.',treasure:'L’organisateur prépare des indices et des codes-réponses. Le premier à trouver un code gagne un point. Dix essais maximum par joueur et par étape. L’hôte passe ensuite à l’étape suivante.',blind:'L’organisateur fournit des extraits audio accessibles en HTTPS et quatre propositions par extrait. Lecture après appui, sur chaque téléphone. Bonne réponse : +1 point. Réponse en 60 secondes.'};
    shell(`<div class="gl-panel"><p>${rules[key]}</p>${['blind','treasure'].includes(key)?'<p class="gl-muted">L’organisateur connaît les réponses de ses étapes personnalisées.</p>':''}${key==='blind'?'<p class="gl-muted">Utilisez uniquement des extraits que vous êtes autorisé à partager. Aucun catalogue musical n’est intégré. Un lien de page YouTube ou Spotify ne constitue pas un fichier audio direct.</p>':''}</div><form id="extra-create"><label class="gl-field">Nombre de joueurs maximum<select name="players">${[2,4,6,8,10,12].map(n=>`<option ${n===6?'selected':''}>${n}</option>`).join('')}</select></label>${key==='truth'?'<label class="gl-field">Nombre de tours<input type="number" name="rounds" value="5" min="1" max="20" required></label>':''}${event?.id?`<label class="gl-toggle"><input type="checkbox" name="event"> Dans l’événement « ${esc(event.name||event.title||'en cours')} »</label>`:''}${['treasure','blind'].includes(key)?`<div id="extra-items">${row()}</div>${button('Ajouter une étape','add-item')}<p class="gl-muted">1 à 20 étapes. Les réponses sont conservées côté serveur.</p>`:''}<button class="gl-primary" type="submit">Créer la partie</button></form>`);
  }
  function scores(s){return `<div class="gl-panel"><h3>Classement</h3>${s.players.map(p=>({name:p.name,points:Number(s.scores.find(x=>x.user_id===p.user_id)?.points||0)})).sort((a,b)=>b.points-a.points).map(p=>`<div class="gl-player"><b>${esc(p.name)}</b><strong>${p.points} pts</strong></div>`).join('')}</div>`;}
  function link(code){const url=new URL(location.pathname,location.origin);url.searchParams.set('game',code);return url.href;}
  function render(){
    const s=session?.state;if(!s||screen!=='room')return;
    if(s.room.revision===lastRevision)return;
    const view=JSON.stringify([s.room.status,s.room.host_id,s.room.round_no,s.phase,s.question,s.submitted,s.scores,s.players.map(p=>[p.user_id,p.ready,p.left_at])]);
    if(view===lastView){lastRevision=s.room.revision;return;}lastView=view;
    const scroll=root.scrollTop,oldAudio=root.querySelector('#extra-audio'),oldAudioKey=oldAudio?.dataset.round;
    const focused=document.activeElement,wasAnswer=focused?.name==='answer'&&focused.closest('#extra-answer'),answerDraft=wasAnswer?focused.value:null;
    const {room:r,question:q}=s,host=r.host_id===s.me,players=s.players.filter(p=>!p.left_at),me=players.find(p=>p.user_id===s.me);
    let body='';
    if(r.status==='waiting')body=`<div class="gl-panel gl-code-panel"><small>Code de la partie</small><div class="gl-room-code">${esc(r.code)}</div>${button('Partager l’invitation','share')}<input id="extra-link" readonly aria-label="Lien de la partie" value="${esc(link(r.code))}"></div><h3>Participants (${players.length}/${r.settings.players})</h3>${players.map(p=>`<div class="gl-player"><b>${esc(p.name)}${p.user_id===s.me?' · toi':''}${p.user_id===r.host_id?' · hôte':''}</b><span>${p.ready?'Prêt':'Pas prêt'}</span></div>`).join('')}${button(me?.ready?'Je ne suis plus prêt':'Je suis prêt','ready',`data-ready="${!me?.ready}"`)}${button('Inviter mes contacts','contacts')}<div id="extra-contacts"></div>${host?button('Lancer la partie','start','',players.length<2||players.some(p=>!p.ready)):'<p>L’hôte lancera quand tous seront prêts.</p>'}`;
    else if(r.status==='finished')body=`<div class="gl-win"><span>🏆</span><h3>Partie terminée</h3></div>${scores(s)}${host?button('Rejouer','replay'):''}${button('Nouvelle partie','setup')}`;
    else if(r.status==='playing'&&q){
      body=`<p class="gl-muted">${key==='treasure'?'Étape':'Tour'} ${r.round_no}/${r.settings.rounds}</p>`;
      if(key==='truth'){
        const actor=players.find(p=>p.user_id===q.actor),myTurn=q.actor===s.me;
        body+=`<div class="gl-panel"><h3>Au tour de ${esc(actor?.name||'Joueur')}</h3>${s.phase==='choose'?'<p>Action ou Vérité ?</p>':`<p>${esc(q.prompt)}</p>`}</div>`;
        if(myTurn&&s.phase==='choose')body+=button('Vérité','choose','data-kind="truth"')+button('Action','choose','data-kind="dare"');
        if(myTurn&&s.phase==='active')body+=button('J’ai terminé','done');
        if(myTurn&&['choose','active'].includes(s.phase))body+=button('Passer sans pénalité','pass');
      }else{
        body+=`<div class="gl-panel"><h3>${esc(q.prompt)}</h3>${key==='blind'?`<audio id="extra-audio" controls preload="none" data-round="${esc(r.id+':'+r.round_no)}" src="${esc(q.audio_url)}" style="max-width:100%;width:100%"></audio><p id="extra-audio-error" role="status"></p>`:''}</div>`;
        if(s.phase==='active'&&(key==='treasure'||!s.submitted))body+=key==='treasure'?'<form id="extra-answer"><label class="gl-field">Code trouvé<input name="answer" maxlength="100" required autocomplete="off"></label><button class="gl-primary" type="submit">Vérifier le code</button></form>':`<form id="extra-answer"><fieldset><legend>Ta réponse</legend>${q.choices.map((c,i)=>`<label class="gl-toggle"><input type="radio" name="answer" required value="${i}"> ${esc(c)}</label>`).join('')}</fieldset><button class="gl-primary" type="submit">Envoyer ma réponse</button></form>`;
        else if(s.phase==='active'&&s.submitted)body+='<p>Réponse enregistrée. En attente du résultat.</p>';
        if(['quiz','blind'].includes(key)&&s.phase==='active')body+=`<p id="extra-deadline" class="gl-muted"></p>${host?button('Révéler les réponses','reveal'):''}`;
        if(s.phase==='reveal'&&q.answer!==undefined)body+=`<p class="gl-panel">Bonne réponse : <b>${esc(q.choices[Number(q.answer)])}</b></p>`;
      }
      if(s.phase==='reveal')body+=`${scores(s)}${host?button(r.round_no>=r.settings.rounds?'Terminer la partie':'Tour suivant','next'):'<p>L’hôte passera au tour suivant.</p>'}`;
    }
    body+=`<div class="gl-room-footer"><span id="extra-connection">Actualisation automatique</span>${button('Actualiser','refresh')}${button('Quitter la partie','leave')}</div>`;
    lastRevision=r.revision;shell(body);root.scrollTop=scroll;
    const audio=root.querySelector('#extra-audio');
    if(audio&&oldAudio&&audio.dataset.round===oldAudioKey){audio.replaceWith(oldAudio);}else if(audio)audio.addEventListener('error',()=>message('Extrait audio inaccessible. Vérifiez le lien direct et son format.'));
    if(answerDraft!==null&&key==='treasure'){const input=root.querySelector('#extra-answer input');if(input){input.value=answerDraft;input.focus({preventScroll:true});}}
    tick();
  }
  function tick(){const el=root?.querySelector('#extra-deadline');if(el&&session?.state)el.textContent=`Temps restant : ${Math.max(0,Math.ceil((Date.parse(session.state.deadline)-Date.now())/1000))} s. L’hôte peut révéler après toutes les réponses ou à l’expiration.`;}
  async function contacts(){const people=await session.rpc('activity_contacts',{target_room:session.roomId});const el=root.querySelector('#extra-contacts');if(el)el.innerHTML=people.length?people.map(p=>button('Inviter '+esc(p.name),'invite',`data-target="${esc(p.id)}"`)).join(''):'<p>Aucun contact. Partagez le code de la partie.</p>';}
  function bind(target){
    if(target.dataset.extraBound)return;target.dataset.extraBound='true';
    target.addEventListener('click',e=>{
      const b=e.target.closest('[data-extra-action]');if(!b)return;e.stopImmediatePropagation();if(busy)return;
      const action=b.dataset.extraAction;
      if(action==='back'){stop();onBack();return;}
      if(action==='setup'){session.disconnect();setup();return;}
      if(action==='add-item'){const list=root.querySelector('#extra-items');if(list.children.length>=20){message('20 étapes maximum.');return;}list.insertAdjacentHTML('beforeend',row());return;}
      if(action==='remove-item'){const list=root.querySelector('#extra-items');if(list.children.length>1)b.closest('.extra-item').remove();else message('Conservez au moins une étape.');return;}
      run(async()=>{
        if(action==='contacts')return contacts();
        if(action==='share'){const url=link(session.state.room.code);if(navigator.share){try{await navigator.share({title:catalogue[key][1],url});}catch(e){if(e.name!=='AbortError')throw e;}}else if(navigator.clipboard){await navigator.clipboard.writeText(url);message('Lien copié.');}else{root.querySelector('#extra-link').select();message('Copiez le lien affiché.');}return;}
        if(action==='refresh'){lastRevision=-1;lastView='';await session.refresh();return;}
        if(action==='leave'){if(confirm('Quitter cette partie ?')){await session.leave();stop();onBack();}return;}
        const data=action==='ready'?{ready:b.dataset.ready==='true'}:action==='choose'?{kind:b.dataset.kind}:action==='invite'?{target:b.dataset.target}:{};
        await session.act(action,data);if(action==='invite')message('Invitation envoyée dans le Salon Jeux du contact.');
      });
    },true);
    target.addEventListener('submit',e=>{
      const form=e.target;if(!['extra-create','extra-answer'].includes(form.id))return;e.preventDefault();e.stopImmediatePropagation();
      const data=new FormData(form);
      run(async()=>{
        if(form.id==='extra-answer'){
          await session.act('answer',{answer:String(data.get('answer')),round_no:session.state.room.round_no});
          if(key==='treasure')message(session.state.phase==='reveal'?'Code correct !':'Code incorrect. Réessayez (10 essais maximum).');
          return;
        }
        const options={game_key:key,players:Number(data.get('players')),rounds:Number(data.get('rounds')||5)};
        if(['treasure','blind'].includes(key))options.items=[...form.querySelectorAll('.extra-item')].map(field=>{
          const value=name=>field.querySelector(`[name="${name}"]`).value.trim();
          const item={prompt:value('prompt'),answer:value('answer')};
          if(key==='blind'){item.choices=[0,1,2,3].map(i=>value('choice'+i));item.audio_url=value('audio_url');const url=new URL(item.audio_url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Lien audio HTTPS sans identifiants requis.');}
          return item;
        });
        await session.create(options,data.has('event')?context().event?.id:null);screen='room';lastRevision=-1;render();
      });
    },true);
  }
  function initialize(game,target,getContext,back){
    stop();key=game;root=target;context=getContext;onBack=back;screen='setup';account=context().user?.id;bind(root);
    session=new window.MyEventGameSession(context,'activity');
    session.addEventListener('state',render);
    session.addEventListener('error',e=>message(e.detail.message||'Connexion interrompue. Actualisez pour réessayer.'));
    session.addEventListener('connection',e=>{const el=root?.querySelector('#extra-connection');if(el)el.textContent=e.detail==='live'?'En direct':'Actualisation automatique';});
  }
  function stop(){session?.disconnect();session=null;screen='setup';lastRevision=-1;lastView='';}
  setInterval(()=>{tick();if(session&&context().user?.id!==account){stop();onBack();}},1000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)root?.querySelector('#extra-audio')?.pause();else session?.refresh();});
  window.OrevamiExtraGames={supports:key=>Object.hasOwn(catalogue,key),open(game,target,getContext,back){initialize(game,target,getContext,back);setup();},async resume(id,game,target,getContext,back){initialize(game,target,getContext,back);screen='room';shell('<p>Chargement de la partie…</p>');await session.connect(id);render();},stop,pause(){root?.querySelector('#extra-audio')?.pause();},active:()=>!!session,restore(){lastRevision=-1;lastView='';if(session?.state&&screen==='room')render();else if(session)setup();}};
})();
