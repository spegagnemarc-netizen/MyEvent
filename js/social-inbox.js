/* Persistent private inbox. All identities and messages come from authenticated Supabase RPCs. */
(() => {
  const $=id=>document.getElementById(id);
  const context=()=>window.myeventCameraContext?.()||{};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=p=>p?.display_name||p?.username||'Utilisateur MyEvent';
  const date=value=>new Date(value).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  const avatar=p=>`<span class="si-avatar">${/^https:\/\//.test(p?.avatar||'')?`<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`:esc(label(p).slice(0,1))}</span>`;
  let account=null,client=null,epoch=0,channel=null,kind=null,conversation=null,snapshot=null,loading=false,refreshAgain=false,refreshTimer=null,viewEpoch=0,more=false;
  let selecting=false,messages=[],peer=null,canSend=false,lastMarked=null,returnFocus=null,previousOverflow='';
  const drafts=new Map(),photos=new Map();
  const body=()=>$(kind==='notifications'?'myeventGlobalNotificationsBody':'myeventGlobalMessagesBody');
  function current(ticket){return ticket===epoch&&context().user?.id===account&&context().sb===client;}
  async function rpc(name,args={}){const ticket=epoch,sb=client;if(!account||!sb)throw Error('Connecte-toi pour ouvrir ta messagerie.');const r=await sb.rpc(name,args);if(!current(ticket))throw Error('Session changée.');if(r.error)throw r.error;return r.data;}
  function status(text){const el=$('si-status');if(el)el.textContent=text;}
  function errorText(e){return /does not exist|schema cache|Could not find/i.test(e.message||'')?'La messagerie doit être activée dans Supabase.':e.message||'Connexion interrompue. Réessaie.';}
  function badges(){for(const [id,count,title] of [['socialHeaderMessagesBtnTop',snapshot?.unread_messages||0,'Messages privés'],['socialHeaderNotificationsBtnTop',snapshot?.unread_notifications||0,'Notifications sociales']]){
    const b=$(id);if(!b)continue;let badge=b.querySelector('.si-badge');if(!badge){badge=document.createElement('span');badge.className='si-badge';b.append(badge);}badge.textContent=count>99?'99+':String(count);badge.hidden=!count;b.setAttribute('aria-label',title+(count?` · ${count} non lus`:''));
  }}
  function open(panel='messages'){
    syncAccount();returnFocus=document.activeElement;if(!kind)previousOverflow=document.body.style.overflow;
    for(const [id,type] of [['myeventGlobalMessagesOverlay','messages'],['myeventGlobalNotificationsOverlay','notifications']]){const el=$(id);el?.classList.toggle('open',type===panel);el?.setAttribute('aria-hidden',String(type!==panel));}
    kind=panel;selecting=false;conversation=null;viewEpoch++;messages=[];document.body.style.overflow='hidden';renderList();refresh();
    $(panel==='messages'?'closeGlobalMessagesBtn':'closeGlobalNotificationsBtn')?.focus();
  }
  function closed(){kind=null;conversation=null;viewEpoch++;messages=[];document.body.style.overflow=previousOverflow;returnFocus?.focus();}
  function close(){for(const id of ['myeventGlobalMessagesOverlay','myeventGlobalNotificationsOverlay']){$(id)?.classList.remove('open');$(id)?.setAttribute('aria-hidden','true');}closed();}
  function renderList(){if(!kind||conversation||selecting)return;const host=body();if(!host)return;
    const rows=kind==='messages'?snapshot?.conversations||[]:snapshot?.notifications||[];
    host.innerHTML=`<div class="si-inbox"><p id="si-status" role="status" aria-live="polite"></p><div class="si-tools">${kind==='messages'?'<button type="button" data-si="new">Nouveau message</button>':'<p>Demandes d’amis, messages et invitations aux jeux.</p>'}<button type="button" data-si="refresh">Actualiser</button></div><div class="si-list">${rows.length?rows.map(r=>kind==='messages'?`<button type="button" class="si-row ${r.unread?'si-unread':''}" data-si="conversation" data-id="${r.id}">${avatar(r.peer)}<span class="si-grow"><b>${esc(label(r.peer))}</b><span>${esc(r.last_message?.body|| (r.last_message?.photo?'Photo':'Aucun message'))}</span><time>${r.last_message?date(r.last_message.created_at):''}</time></span>${r.unread?`<span class="si-count">${r.unread}</span>`:''}</button>`:notificationRow(r)).join(''):`<p class="si-empty">${!account?'Connecte-toi pour accéder à ton espace privé.':snapshot?kind==='messages'?'Aucune conversation. Choisis un ami pour commencer.':'Aucune notification sociale.':'Chargement…'}</p>`}</div></div>`;
  }
  function notificationRow(n){const descriptions={friend_request:'t’a envoyé une demande d’ami.',friend_accepted:'a accepté votre lien d’amitié.',private_message:'t’a envoyé un message privé.',game_invitation:'t’invite à une partie.'};return `<button type="button" class="si-row ${n.read_at?'':'si-unread'}" data-si="notification" data-id="${n.id}">${avatar(n.actor)}<span class="si-grow"><b>${esc(label(n.actor))}</b><span>${descriptions[n.kind]||'Nouvelle activité sociale.'}</span><time>${date(n.created_at)}</time></span>${n.read_at?'':'<span class="si-dot" aria-label="Non lu"></span>'}</button>`;}
  async function refresh(){if(!account||!client)return;if(loading){refreshAgain=true;return;}loading=true;const ticket=epoch;
    try{const data=await rpc('social_inbox_snapshot');if(!current(ticket))return;snapshot=data;badges();if(kind==='messages'&&conversation)await loadHistory();else renderList();}
    catch(e){if(current(ticket))status(errorText(e));}finally{if(current(ticket)){loading=false;if(refreshAgain){refreshAgain=false;schedule();}}}
  }
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,200);}
  async function chooseFriend(){selecting=true;const accountTicket=epoch;const ticket=++viewEpoch;status('Chargement des amis…');try{
    const result=await client.from('friendships').select('user_low,user_high,status').eq('status','accepted');if(result.error)throw result.error;if(!current(accountTicket))return;
    const ids=(result.data||[]).map(r=>r.user_low===account?r.user_high:r.user_low);
    const friends=ids.length?await rpc('social_friend_profiles',{ids}):[];
    if(ticket!==viewEpoch||!kind)return;
    body().innerHTML=`<div class="si-inbox"><button type="button" data-si="list">‹ Conversations</button><h4>Choisir un ami</h4><p id="si-status" role="status"></p>${friends.length?friends.map(p=>`<button type="button" class="si-row" data-si="peer" data-id="${p.id}">${avatar(p)}<b>${esc(label(p))}</b></button>`).join(''):'<p>Aucun ami accepté pour le moment.</p>'}</div>`;
  }catch(e){status(errorText(e));}}
  async function openPeer(id){if(kind!=='messages')open('messages');const ticket=++viewEpoch;try{const cid=await rpc('dm_open',{other_id:id});if(ticket!==viewEpoch)return;await openConversation(cid);}catch(e){status(errorText(e));}}
  async function openConversation(id){selecting=false;conversation=id;viewEpoch++;messages=[];lastMarked=null;more=false;peer=null;
    body().innerHTML='<div class="si-inbox"><button type="button" data-si="list">‹ Conversations</button><p id="si-status" role="status">Chargement…</p></div>';
    await loadHistory(true);
  }
  function threadShell(){const draft=drafts.get(conversation);body().innerHTML=`<div class="si-inbox si-thread"><div class="si-thread-head"><button type="button" data-si="list">‹</button>${avatar(peer)}<b>${esc(label(peer))}</b></div><p id="si-status" role="status" aria-live="polite"></p><button type="button" id="si-older" data-si="older">Messages précédents</button><div id="si-messages" class="si-messages" aria-label="Messages de la conversation"></div><form id="si-compose"><label for="si-text" class="si-sr">Ton message</label><textarea id="si-text" maxlength="4000" rows="2" placeholder="Ton message…" ${canSend?'':'disabled'}>${esc(draft?.text||'')}</textarea><div class="si-compose-actions"><label class="si-photo">Photo<input id="si-photo" type="file" accept="image/jpeg,image/png,image/webp" ${canSend?'':'disabled'}></label><span id="si-file-name"></span><button type="submit" ${canSend?'':'disabled'}>${draft?.pending?'Réessayer l’envoi':'Envoyer'}</button></div><small>Photos JPG, PNG ou WebP · 10 Mo maximum</small></form>${canSend?'':'<p>Vous devez être amis pour envoyer de nouveaux messages. Votre historique reste disponible.</p>'}</div>`;
    if(draft?.pending){$('si-text').disabled=true;$('si-photo').disabled=true;$('si-file-name').textContent=draft.pending.file?.name||'';}
    $('si-text')?.addEventListener('input',()=>{const d=drafts.get(conversation)||{};d.text=$('si-text').value;drafts.set(conversation,d);});
    $('si-photo')?.addEventListener('change',()=>{const file=$('si-photo').files[0];$('si-file-name').textContent=file?.name||'';});
    $('si-compose')?.addEventListener('submit',send);
  }
  async function loadHistory(initial=false,older=false){const id=conversation,view=viewEpoch,ticket=epoch;if(!id)return;
    const list=$('si-messages'),follow=initial||!!list&&(list.scrollHeight-list.scrollTop-list.clientHeight<70);
    try{const data=await rpc('dm_history',{target_conversation:id,before_id:older&&messages.length?messages[0].id:null});if(view!==viewEpoch||!current(ticket)||conversation!==id)return;
      peer=data.peer;canSend=data.can_send;const priorHeight=list?.scrollHeight||0,priorTop=list?.scrollTop||0;
      if(initial||older)more=data.messages.length===50;
      const map=new Map(messages.map(m=>[m.id,m]));data.messages.forEach(m=>map.set(m.id,m));messages=[...map.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
      if(initial||!$('si-compose'))threadShell();
      const urls=await Promise.all(messages.filter(m=>m.media_path).map(async m=>{let cached=photos.get(m.media_path);if(!cached||cached.expires<Date.now()){const r=await client.storage.from('dm-media').createSignedUrl(m.media_path,600);if(!r.error)cached={url:r.data.signedUrl,expires:Date.now()+480000};if(cached)photos.set(m.media_path,cached);}return [m.media_path,cached?.url];}));
      if(view!==viewEpoch||!current(ticket))return;const signed=new Map(urls);const target=$('si-messages');
      target.innerHTML=messages.map(m=>`<article class="si-message ${m.sender_id===account?'si-mine':''}">${m.body?`<p>${esc(m.body)}</p>`:''}${m.media_path?signed.get(m.media_path)?`<a href="${esc(signed.get(m.media_path))}" target="_blank" rel="noopener noreferrer"><img class="si-photo-message" src="${esc(signed.get(m.media_path))}" alt="Photo privée" loading="lazy"></a>`:'<p>Photo indisponible. Actualise la conversation.</p>':''}<time>${date(m.created_at)}</time></article>`).join('')||'<p class="si-empty">Envoyez votre premier message.</p>';
      $('si-older').hidden=!more;status('');
      if(older)target.scrollTop=priorTop+target.scrollHeight-priorHeight;else if(follow)target.scrollTop=target.scrollHeight;
      else target.scrollTop=priorTop;
      // Only the exact visible snapshot is marked read; concurrent later messages remain unread.
      if(!older&&follow&&!document.hidden&&kind==='messages'&&messages.length){const last=messages.at(-1).id;if(last!==lastMarked){await rpc('dm_mark_read',{target_conversation:id,through_id:last});if(view!==viewEpoch||!current(ticket))return;lastMarked=last;schedule();}}
    }catch(e){if(view===viewEpoch&&current(ticket))status(errorText(e));}
  }
  async function send(e){e.preventDefault();const id=conversation,view=viewEpoch,ticket=epoch,form=$('si-compose');if(form.dataset.sending)return;const d=drafts.get(id)||{};
    if(!d.pending){const file=$('si-photo').files[0]||null,text=$('si-text').value.trim();if(!text&&!file)return;
      if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)){status('Choisis une photo JPG, PNG ou WebP de 10 Mo maximum.');return;}
      d.text=text;d.pending={text,file,nonce:crypto.randomUUID(),path:null};drafts.set(id,d);
    }
    form.dataset.sending='true';form.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=true);status('Envoi…');
    try{const pending=d.pending;if(pending.file&&!pending.path){const path=`${account}/${id}/${pending.nonce}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[pending.file.type]}`;
        const r=await client.storage.from('dm-media').upload(path,pending.file,{upsert:false,contentType:pending.file.type});if(!current(ticket))return;
        // The upload may have succeeded before its response was lost. Verify
        // our exact private object instead of depending on Storage's error code.
        if(r.error){const existing=await client.storage.from('dm-media').createSignedUrl(path,60);if(!current(ticket))return;if(existing.error)throw r.error;}
        pending.path=path;
      }
      await rpc('dm_send',{target_conversation:id,message_body:pending.text,client_nonce:pending.nonce,photo_path:pending.path});if(!current(ticket))return;drafts.delete(id);
      if(view===viewEpoch){threadShell();await loadHistory(true);}schedule();
    }catch(error){if(current(ticket)&&view===viewEpoch){status(errorText(error)+' Ton message est conservé : réessaie.');const b=form.querySelector('button[type=submit]');b.disabled=false;b.textContent='Réessayer l’envoi';}}
    finally{delete form.dataset.sending;}
  }
  async function notification(id){const n=snapshot?.notifications.find(n=>n.id===id);if(!n)return;
    try{await rpc('social_notification_read',{notification_id:id});if(n.kind==='private_message'){open('messages');await openConversation(n.conversation_id);}
      else if(n.kind==='game_invitation'){close();$('socialHeaderGamesBtn')?.click();}
      else{close();$('socialFriendsShortcut')?.click();}schedule();
    }catch(e){status(errorText(e));}
  }
  function syncAccount(){const {sb,user}=context();if(account===(user?.id||null)&&client===sb)return;
    if(channel&&client)client.removeChannel(channel);epoch++;viewEpoch++;client=sb;account=user?.id||null;channel=null;loading=false;refreshAgain=false;snapshot=null;selecting=false;conversation=null;messages=[];drafts.clear();photos.clear();badges();if(kind)renderList();
    if(account&&client){channel=client.channel('private-inbox-'+account)
      .on('postgres_changes',{event:'*',schema:'public',table:'dm_messages'},schedule)
      .on('postgres_changes',{event:'*',schema:'public',table:'dm_conversations'},schedule)
      .on('postgres_changes',{event:'*',schema:'public',table:'social_notifications',filter:'user_id=eq.'+account},schedule)
      .subscribe(()=>schedule());refresh();}
  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-si]');if(!button)return;
    if(button.dataset.si==='new')chooseFriend();else if(button.dataset.si==='list'){selecting=false;conversation=null;viewEpoch++;messages=[];renderList();refresh();}
    else if(button.dataset.si==='conversation')openConversation(button.dataset.id);else if(button.dataset.si==='peer')openPeer(button.dataset.id);
    else if(button.dataset.si==='notification')notification(button.dataset.id);else if(button.dataset.si==='older')loadHistory(false,true);else if(button.dataset.si==='refresh')refresh();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&kind)close();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncAccount();refresh();}});
  window.addEventListener('online',()=>{syncAccount();refresh();});
  window.myeventSocialInbox={open,openPeer,closed};
  setInterval(syncAccount,1000);setInterval(()=>{if(!document.hidden)refresh();},15000);syncAccount();
})();
