/* Social friends and 24-hour stories. Uses the existing authenticated Supabase client. */
(() => {
  const $ = id => document.getElementById(id);
  const context = () => window.myeventCameraContext?.() || {};
  let activeId = null, channel = null, refreshTimer = null, storyTimer = null, stripExpiryTimer = null;
  let storyRows = [], viewerIndex = 0, storyMode = false, startedAt = 0, interactionTicket = 0;
  const initialMyStoryBubble = $('socialMyStory')?.querySelector('.socialStoryBubble');
  const defaultMyStoryContent = [...(initialMyStoryBubble?.childNodes || [])].map(node => node.cloneNode(true));
  let thumbnailExpiryTimer = null;
  function latestOwnStory(userId) {
    return storyRows.filter(r => r.author_id === userId && Date.parse(r.expires_at) > Date.now())
      .reduce((best, r) => !best || Date.parse(r.created_at) > Date.parse(best.created_at) ? r : best, null);
  }
  function showMyStoryThumbnail(userId) {
    const myStoryBubble = $('socialMyStory')?.querySelector('.socialStoryBubble');
    if (!myStoryBubble) return;
    clearTimeout(thumbnailExpiryTimer);
    const latest = latestOwnStory(userId);
    const me = $('socialMyStory');
    me.classList.toggle('hasStory', !!latest);
    if (!latest) {
      myStoryBubble.replaceChildren(...defaultMyStoryContent.map(node => node.cloneNode(true)));
      const profileImage = document.querySelector('#profileAvatar img');
      if(profileImage && myStoryBubble.textContent.trim() === '👤') {
        const photo=profileImage.cloneNode(true);photo.alt='';myStoryBubble.replaceChildren(photo);
      }
      return;
    }
    const preview = document.createElement(latest.media_type === 'video' ? 'video' : 'img');
    preview.className = 'myStoryThumbnail';
    preview.src = latest.url;
    preview.setAttribute('aria-hidden', 'true');
    if (latest.media_type === 'video') {
      preview.muted = true;
      preview.playsInline = true;
      preview.preload = 'auto';
      preview.addEventListener('loadedmetadata', () => {
        if (preview.isConnected && preview.duration) preview.currentTime = Math.min(0.1, preview.duration / 2);
      }, {once:true});
      preview.addEventListener('seeked', () => {
        if (!preview.isConnected || !preview.videoWidth || !preview.videoHeight) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = Math.round(160 * preview.videoHeight / preview.videoWidth);
          canvas.getContext('2d').drawImage(preview, 0, 0, canvas.width, canvas.height);
          const frame = document.createElement('img');
          frame.className = 'myStoryThumbnail'; frame.alt = '';
          frame.src = canvas.toDataURL('image/jpeg', 0.75);
          preview.replaceWith(frame);
        } catch (_) { /* Keep the video frame when canvas capture is unavailable. */ }
      }, {once:true});
    } else preview.alt = '';
    myStoryBubble.replaceChildren(preview);
    thumbnailExpiryTimer = setTimeout(() => showMyStoryThumbnail(userId),
      Math.min(Date.parse(latest.expires_at) - Date.now() + 50, 2147483647));
  }
  const status = text => { if ($('socialFriendStatus')) $('socialFriendStatus').textContent = text; };
  const check = result => { if (result.error) throw result.error; return result.data; };
  const profileName = p => p?.display_name || p?.username || 'Membre MyEvent';
  let invitation = window.myeventInvitations?.get('friendInvite') || new URL(location.href).searchParams.get('friendInvite');
  function clearInvitation() {
    if (window.myeventInvitations) window.myeventInvitations.clear('friendInvite');
    else { const url = new URL(location.href); url.searchParams.delete('friendInvite'); history.replaceState(history.state, '', url); }
    invitation = null;
  }
  async function prepareInvitation() {
    const {sb,user} = context(); if (!sb || !user) { status('Connecte-toi pour inviter un ami.'); return; }
    const button = $('invitePhoneContactsBtn'); button.disabled = true;
    try {
      const token = check(await sb.rpc('create_friend_invite'));
      const url = new URL(location.pathname, location.origin); url.searchParams.set('friendInvite', token);
      $('socialFriendInviteLink').value = url.href;
      $('socialFriendInviteShare').classList.remove('hidden');
      status('Lien prêt : partage-le pour que ton contact puisse accepter ton invitation.');
    } catch (e) { status('Invitation indisponible : ' + (e.message || String(e))); }
    finally { button.disabled = false; }
  }
  async function shareInvitation() {
    const url = $('socialFriendInviteLink').value;
    try {
      if (navigator.share) await navigator.share({title:'Invitation MyEvent',text:'Accepte mon invitation d’ami sur MyEvent.',url});
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); status('Lien d’invitation copié.'); }
      else { $('socialFriendInviteLink').select(); status('Copie ce lien et envoie-le à ton contact.'); }
    } catch (e) { if (e.name !== 'AbortError') status('Partage impossible : ' + e.message); }
  }
  async function inspectInvitation() {
    if (!invitation) return;
    $('socialFriendInvitePrompt')?.classList.add('hidden');
    $('socialFriendsShortcut')?.click();
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(invitation)) { clearInvitation(); status('Lien d’invitation invalide.'); return; }
    try {
      const {sb,user} = context();
      const profiles = check(await sb.rpc('friend_invite_preview', {invitation})) || [];
      if (!profiles.length) { clearInvitation(); status('Invitation expirée, déjà utilisée ou envoyée à toi-même.'); return; }
      const profile = profiles[0];
      const picture = $('socialFriendInviteAvatar'); picture.replaceChildren();
      if (profile.avatar && /^(https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/.test(profile.avatar)) {
        const image = document.createElement('img'); image.src = profile.avatar; image.alt = ''; picture.append(image);
      } else picture.textContent = profile.avatar && profile.avatar.length < 8 ? profile.avatar : profileName(profile).charAt(0).toUpperCase();
      $('socialFriendInviteName').textContent = profileName(profile);
      $('socialFriendInviteUsername').textContent = profile.username ? '@' + profile.username : '';
      const relation = relations.find(r => (r.user_low === user.id && r.user_high === profile.id) || (r.user_high === user.id && r.user_low === profile.id));
      const alreadyFriends = relation?.status === 'accepted';
      $('socialFriendInviteDetail').textContent = alreadyFriends ? 'Vous êtes déjà amis sur MyEvent.' : relation?.status === 'pending' ? 'Une demande existe déjà. Acceptez ce lien pour devenir amis.' : 'Vous invite à devenir amis sur MyEvent.';
      $('socialFriendInviteAccept').hidden = alreadyFriends;
      $('socialFriendInvitePrompt').classList.remove('hidden');
      if (alreadyFriends) clearInvitation();
    } catch (e) { status('Invitation indisponible : ' + e.message); }
  }
  async function acceptInvitation() {
    const {sb} = context(), button = $('socialFriendInviteAccept'); button.disabled = true;
    try {
      check(await sb.rpc('accept_friend_invite', {invitation}));
      clearInvitation();
      $('socialFriendInvitePrompt').classList.add('hidden');
      await loadFriends(); await loadStories();
      status('Invitation acceptée : vous êtes maintenant amis.');
    } catch (e) { status('Impossible d’accepter : ' + e.message); }
    finally { button.disabled = false; }
  }
  const avatar = p => {
    const el = document.createElement('div'); el.className = 'socialPostAvatar';
    if (p?.avatar && /^https:\/\//.test(p.avatar)) {
      const img = document.createElement('img'); img.src = p.avatar; img.alt = ''; el.append(img);
    } else el.textContent = '👤';
    return el;
  };
  function person(container, profile, label, action, options = {}) {
    const row = document.createElement('div'); row.className = 'socialPerson'; row.append(avatar(profile));
    const name = document.createElement('b'); name.className = 'grow'; name.textContent = profileName(profile); row.append(name);
    if(action==='remove'){
      const link=document.createElement('button');link.type='button';link.className='si-profile-link';link.textContent=profileName(profile);
      link.addEventListener('click',()=>openMemberProfile({id:profile.id,name:profileName(profile),username:profile.username,avatar:profile.avatar,hasProfile:true,role:'Ami'}));
      name.replaceWith(link);
    }
    if (action) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = options.iconOnly ? '×' : label;
      if (options.className) button.classList.add(options.className);
      if (options.iconOnly) {
        button.classList.add('socialFriendIconAction');
        button.setAttribute('aria-label', label + ' ' + profileName(profile));
        button.title = label;
      }
      button.addEventListener('click', () => mutate(profile.id, action, button)); row.append(button);
    }
    container.append(row);
    return row;
  }
  function incomingPerson(container, profile) {
    const row = person(container, profile);
    const actions = document.createElement('div'); actions.className = 'socialFriendRowActions';
    [['Accepter','accept','accept'],['Refuser','decline','decline']].forEach(([label,action,className]) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.classList.add(className);
      button.addEventListener('click', () => mutate(profile.id, action, button)); actions.append(button);
    });
    row.append(actions);
  }
  async function mutate(id, action, button) {
    const {sb,user} = context(); if (!sb || !user) return;
    button.disabled = true;
    try { check(await sb.rpc('friend_action', {other_id:id, action})); await loadFriends(); await loadStories(); }
    catch (e) { status(e.message || 'Action impossible.'); button.disabled = false; }
  }
  async function profilesFor(ids) {
    const {sb} = context(); if (!ids.length) return new Map();
    const data = check(await sb.rpc('social_friend_profiles', {ids:[...new Set(ids)]}));
    return new Map((data || []).map(p => [p.id,p]));
  }
  let relations = [];
  async function loadFriends() {
    const {sb,user} = context(); if (!sb || !user) return;
    try {
      relations = check(await sb.from('friendships').select('user_low,user_high,requester,status').or(`user_low.eq.${user.id},user_high.eq.${user.id}`)) || [];
      const profiles = await profilesFor(relations.map(r => r.user_low === user.id ? r.user_high : r.user_low));
      for (const id of ['socialFriendIncoming','socialFriendOutgoing','socialFriendList']) $(id)?.replaceChildren();
      const acceptedProfiles=[];
      for (const r of relations) {
        const id = r.user_low === user.id ? r.user_high : r.user_low, p = profiles.get(id) || {id};
        if (r.status === 'accepted') { acceptedProfiles.push(p); person($('socialFriendList'),p,'Supprimer','remove',{iconOnly:true,className:'remove'}); }
        else if (r.requester === user.id) person($('socialFriendOutgoing'),p,'Annuler','cancel');
        else incomingPerson($('socialFriendIncoming'),p);
      }
      const preview=$('homeFriendsPreview');
      if(preview){
        preview.replaceChildren();
        if(acceptedProfiles.length){
          acceptedProfiles.slice(0,3).forEach((p,index)=>{
            const bubble=document.createElement('span');
            bubble.className='homeFriendProfileBubble';
            bubble.title=profileName(p);
            if(p.avatar&&/^https:\/\//.test(p.avatar)){
              const img=document.createElement('img');img.src=p.avatar;img.alt='';bubble.append(img);
            }else if(p.avatar){
              bubble.textContent=p.avatar;
            }else{
              bubble.textContent=(profileName(p).trim().charAt(0)||'👤').toUpperCase();
            }
            preview.append(bubble);
          });
          if(acceptedProfiles.length>3){
            const more=document.createElement('em');more.textContent='+'+(acceptedProfiles.length-3);preview.append(more);
          }
        }else{
          preview.textContent='👥';
        }
      }
      status('');
    } catch(e) { status('Amis indisponibles : ' + e.message); }
  }
  async function searchUsers() {
    const {sb,user} = context(); if (!sb || !user) return;
    const input = document.querySelector('#socialFriendsView .socialSearch input');
    const query = input?.value.trim() || '';
    const output = $('socialFriendResults'); output.replaceChildren();
    if (query.length < 2) { status('Saisis au moins deux caractères.'); return; }
    try {
      const safe = query.replace(/[%_,()]/g,' ').trim();
      const rows = check(await sb.rpc('social_profile_search', {term:safe})) || [];
      rows.filter(p => p.id !== user.id).forEach(p => {
        const r = relations.find(x => x.user_low === p.id || x.user_high === p.id);
        const action = !r ? 'send' : r.status === 'accepted' ? 'remove' : r.requester === user.id ? 'cancel' : 'accept';
        const label = {send:'Ajouter',remove:'Supprimer',cancel:'Annuler',accept:'Accepter'}[action];
        person(output,p,label,action);
      });
      status(output.children.length ? '' : 'Aucun utilisateur trouvé.');
    } catch(e) { status('Recherche impossible : ' + e.message); }
  }
  function initializeViewer() {
    const el = document.createElement('div'); el.id = 'socialStoryViewer'; el.className = 'socialStoryViewer'; el.hidden = true;
    el.innerHTML = '<div class="storyProgress"><span></span></div><div class="storyHeader"><b></b><button type="button" data-story="close" aria-label="Fermer">✕</button></div><div class="storyMedia"></div><p class="storyCaption"></p><button type="button" class="storyPrevious" data-story="previous" aria-label="Story précédente">‹</button><button type="button" class="storyNext" data-story="next" aria-label="Story suivante">›</button><div class="storyInteractions"><button type="button" class="storyLike" data-story="like" aria-label="Aimer la Story" aria-pressed="false">♡ <span>0</span></button><button type="button" class="storyLikers" data-story="likers" hidden>Voir les likes</button><form class="storyReply"><input maxlength="3750" placeholder="Répondre à la Story…" aria-label="Répondre à la Story"><button type="submit">Envoyer</button></form><p class="storyInteractionStatus" role="status"></p></div><div class="storyLikersPanel" hidden><button type="button" data-story="hide-likers" aria-label="Fermer la liste">✕</button><h3>J’aime</h3><div class="storyLikersList"></div></div><div class="storyOwnerActions"><button type="button" class="storyAddNew" data-story="add">＋ Nouvelle story</button><button type="button" class="storyDelete" data-story="delete">Supprimer</button></div>';
    document.body.append(el);
    el.addEventListener('click', e => { const action = e.target.closest('[data-story]')?.dataset.story;
      if(action === 'close') closeViewer(); if(action === 'previous') showStory(viewerIndex - 1);
      if(action === 'next') showStory(viewerIndex + 1); if(action === 'add'){closeViewer();createStory();} if(action === 'delete') deleteStory();
      if(action === 'like') toggleStoryLike(); if(action === 'likers') showStoryLikers();
      if(action === 'hide-likers') el.querySelector('.storyLikersPanel').hidden=true; });
    el.querySelector('.storyReply').addEventListener('submit',replyToStory);
    let touchX = 0; el.addEventListener('touchstart',e => { touchX=e.changedTouches[0].clientX; },{passive:true});
    el.addEventListener('touchend',e => {const diff=e.changedTouches[0].clientX-touchX;
      if(e.target.closest('.storyInteractions,.storyLikersPanel') || Math.abs(diff)<60)return;
      showStory(viewerIndex+(diff<0?1:-1));},{passive:true});
    document.addEventListener('keydown',e => {if(el.hidden)return;
      if(e.key==='Escape')closeViewer(); if(e.key==='ArrowRight')showStory(viewerIndex+1);
      if(e.key==='ArrowLeft')showStory(viewerIndex-1); });
  }
  function closeViewer() { clearTimeout(storyTimer); interactionTicket++; const el=$('socialStoryViewer'); el.hidden=true; el.querySelector('.storyMedia').replaceChildren(); document.body.style.overflow=''; }
  async function refreshStoryLike(id,ticket=interactionTicket) {
    const {sb}=context(); if(!sb)return;
    try {const data=check(await sb.rpc('story_like_summary',{target_story:id}));
      if(ticket!==interactionTicket || storyRows[viewerIndex]?.id!==id)return;
      const button=$('socialStoryViewer').querySelector('.storyLike');
      button.dataset.liked=String(data.liked);button.setAttribute('aria-pressed',String(data.liked));
      button.firstChild.textContent=data.liked?'♥ ':'♡ ';
      button.querySelector('span').textContent=data.count;
    }catch(e){if(ticket===interactionTicket)storyInteractionStatus('Likes indisponibles : '+e.message);}
  }
  function storyInteractionStatus(message){$('socialStoryViewer').querySelector('.storyInteractionStatus').textContent=message;}
  async function toggleStoryLike(){const item=storyRows[viewerIndex],{sb,user}=context();if(!item||!user)return;
    const button=$('socialStoryViewer').querySelector('.storyLike');button.disabled=true;
    try {if(button.dataset.liked==='true')check(await sb.from('social_story_likes').delete().eq('story_id',item.id).eq('user_id',user.id));
      else check(await sb.from('social_story_likes').insert({story_id:item.id,user_id:user.id}));
      await refreshStoryLike(item.id);
    }catch(e){storyInteractionStatus('Like impossible : '+e.message);}finally{button.disabled=false;}
  }
  async function showStoryLikers(){const item=storyRows[viewerIndex],{sb,user}=context();if(!item||item.author_id!==user?.id)return;
    const panel=$('socialStoryViewer').querySelector('.storyLikersPanel'),list=panel.querySelector('.storyLikersList');
    panel.hidden=false;list.textContent='Chargement…';
    try {const rows=check(await sb.from('social_story_likes').select('user_id').eq('story_id',item.id));
      const profiles=await profilesFor(rows.map(r=>r.user_id));if(storyRows[viewerIndex]?.id!==item.id||panel.hidden)return;
      list.replaceChildren();rows.forEach(row=>{const p=profiles.get(row.user_id),entry=document.createElement('div');
        entry.className='storyLiker';entry.append(avatar(p),document.createTextNode(profileName(p)));list.append(entry);});
      if(!rows.length)list.textContent='Aucun like pour le moment.';
    }catch(e){list.textContent=e.message;}
  }
  async function replyToStory(e){e.preventDefault();const item=storyRows[viewerIndex],{sb,user}=context();
    if(!item||!user||item.author_id===user.id)return;
    const form=e.currentTarget,input=form.querySelector('input'),message=input.value.trim();if(!message)return;
    const button=form.querySelector('button');button.disabled=true;storyInteractionStatus('Envoi…');
    try {const conversation=check(await sb.rpc('dm_open',{other_id:item.author_id}));
      const caption=item.caption?.trim();const contextText=`↩ Réponse à la Story du ${new Date(item.created_at).toLocaleString('fr-FR')}${caption?' · '+caption.slice(0,100):''}\n${message}`;
      check(await sb.rpc('dm_send',{target_conversation:conversation,message_body:contextText,client_nonce:crypto.randomUUID()}));
      input.value='';storyInteractionStatus('Réponse envoyée dans Messages privés.');
    }catch(error){storyInteractionStatus('Envoi impossible : '+error.message);}finally{button.disabled=false;}
  }
  function showStory(index) {
    if(index < 0 || index >= storyRows.length) { closeViewer(); return; }
    if(Date.parse(storyRows[index].expires_at)<=Date.now()){loadStories();closeViewer();return;}
    clearTimeout(storyTimer); interactionTicket++;viewerIndex=index; startedAt=Date.now();
    const item=storyRows[index], el=$('socialStoryViewer'); el.hidden=false; document.body.style.overflow='hidden';
    el.querySelector('.storyHeader b').textContent=profileName(item.profile);
    el.querySelector('.storyCaption').textContent=item.caption || '';
    const own=item.author_id===context().user?.id; el.querySelector('.storyDelete').hidden=!own; el.querySelector('.storyAddNew').hidden=!own;
    el.querySelector('.storyReply').hidden=own;el.querySelector('.storyReply input').value='';
    el.querySelector('.storyLikers').hidden=!own;el.querySelector('.storyLikersPanel').hidden=true;
    el.querySelector('.storyLike').dataset.liked='false';el.querySelector('.storyLike').setAttribute('aria-pressed','false');
    el.querySelector('.storyLike').firstChild.textContent='♡ ';el.querySelector('.storyLike span').textContent='…';storyInteractionStatus('');
    refreshStoryLike(item.id);
    const media=document.createElement(item.media_type==='video'?'video':'img'); media.src=item.url;
    if(item.media_type==='video') { media.autoplay=true; media.playsInline=true; media.addEventListener('ended',()=>showStory(viewerIndex+1),{once:true}); }
    el.querySelector('.storyMedia').replaceChildren(media);
    const progress=el.querySelector('.storyProgress span'); progress.style.width='0%';
    const tick=()=>{if(el.hidden||storyRows[viewerIndex]?.id!==item.id)return; const duration=item.media_type==='video' ? Math.min(30000,media.duration*1000||15000) : 5000;
      if(el.querySelector('.storyReply input')===document.activeElement||!el.querySelector('.storyLikersPanel').hidden){startedAt+=100;storyTimer=setTimeout(tick,100);return;}
      const ratio=Math.min(1,(Date.now()-startedAt)/duration); progress.style.width=(ratio*100)+'%';
      if(ratio>=1)showStory(viewerIndex+1); else storyTimer=setTimeout(tick,100);}; tick();
  }
  async function deleteStory() {
    const item=storyRows[viewerIndex], {sb,user}=context(); if(!item || item.author_id!==user?.id)return;
    try { check(await sb.from('social_stories').delete().eq('id',item.id)); closeViewer();
      await sb.storage.from('story-media').remove([item.media_path]); await loadStories(); }
    catch(e) { alert('Suppression impossible : '+e.message); }
  }
  async function loadStories() {
    const {sb,user}=context(); if(!sb || !user)return;
    try {
      const rows=check(await sb.from('social_stories').select('id,author_id,media_path,media_type,caption,created_at,expires_at')
        .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(100))||[];
      const profiles=await profilesFor(rows.map(r=>r.author_id));
      const previous=storyRows;
      const media=await Promise.all(rows.map(async r => {
        const result=await sb.storage.from('story-media').download(r.media_path);
        return result.error ? null : {...r,url:URL.createObjectURL(result.data),profile:profiles.get(r.author_id)};
      }));
      storyRows=media.filter(Boolean).sort((a,b)=>a.author_id.localeCompare(b.author_id)||a.created_at.localeCompare(b.created_at));
      clearTimeout(stripExpiryTimer);
      const nextExpiry=Math.min(...storyRows.map(r=>Date.parse(r.expires_at)));
      if(Number.isFinite(nextExpiry))stripExpiryTimer=setTimeout(loadStories,Math.max(50,Math.min(nextExpiry-Date.now()+100,2147483647)));
      previous.forEach(r=>URL.revokeObjectURL(r.url));
      const strip=document.querySelector('#socialHome .socialStories');
      strip?.querySelectorAll('.socialStory[data-story-author]').forEach(x=>x.remove());
      showMyStoryThumbnail(user.id);
      const me=$('socialMyStory');
      me.onclick=null;
      const friendSection=$('friendStoriesSection'),friendStrip=$('friendStoriesStrip');
      if(friendStrip){
        friendStrip.replaceChildren();
      }
      const latestByAuthor=new Map();storyRows.forEach((r,i)=>{
        if(r.author_id!==user.id&&Date.parse(r.expires_at)>Date.now())latestByAuthor.set(r.author_id,{r,i});
      });
      latestByAuthor.forEach(({r,i})=>{
        if(!friendStrip)return;
        const mini=document.createElement('button');mini.type='button';mini.className='friendStoryMini';
        const ring=document.createElement('div');ring.className='miniRing';const inside=document.createElement('div');
        inside.append(storyCardPreview(r));ring.append(inside);
        const label=document.createElement('span');label.textContent=profileName(r.profile).split(/\s+/)[0];
        mini.append(ring,label);mini.onclick=()=>showStory(i);friendStrip.append(mini);
      });
      friendSection?.classList.remove('hidden');
      if(friendSection)friendSection.style.display='block';
    } catch(e) { console.warn('Stories indisponibles',e); }
  }
  function storyCardPreview(story){
    if(story.media_type!=='video'){const image=document.createElement('img');image.src=story.url;image.alt='';return image;}
    const frame=document.createElement('video');frame.src=story.url;frame.muted=true;frame.playsInline=true;frame.preload='metadata';
    frame.addEventListener('loadedmetadata',()=>{if(frame.duration&&frame.isConnected)frame.currentTime=Math.min(.2,frame.duration/2);},{once:true});
    frame.addEventListener('seeked',()=>{if(!frame.isConnected||!frame.videoWidth)return;
      try{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=Math.round(160*frame.videoHeight/frame.videoWidth);
        canvas.getContext('2d').drawImage(frame,0,0,canvas.width,canvas.height);
        const image=document.createElement('img');image.alt='';image.src=canvas.toDataURL('image/jpeg',.8);frame.replaceWith(image);
      }catch(_){/* The paused video frame remains visible if Safari blocks canvas capture. */}
    },{once:true});
    return frame;
  }
  async function publishStory(file) {
    const {sb,user}=context(); if(!sb || !user || !file) return;
    if(!/^(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm))$/.test(file.type)||file.size>50*1024*1024)
      throw new Error('Photo ou vidéo non prise en charge (50 Mo maximum).');
    const extension=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'})[file.type];
    const path=`${user.id}/${crypto.randomUUID()}.${extension}`;
    check(await sb.storage.from('story-media').upload(path,file,{contentType:file.type,upsert:false}));
    try { check(await sb.from('social_stories').insert({author_id:user.id,media_path:path,
      media_type:file.type.startsWith('video/')?'video':'image', caption:$('storyCaptionInput')?.value?.trim()||''})); }
    catch(e) { await sb.storage.from('story-media').remove([path]); throw e; }
    await loadStories();
  }
  function createStory() {
    const sheet=$('storyCreateSheet'); sheet.hidden=false; $('storyCaptionInput').value='';
  }
  function setupCreation() {
    const sheet=document.createElement('div'); sheet.id='storyCreateSheet'; sheet.className='storyCreateSheet'; sheet.hidden=true;
    sheet.innerHTML='<div><h3>Ma Story</h3><input id="storyCaptionInput" maxlength="500" placeholder="Légende (facultative)"><input id="storyFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" hidden><button type="button" id="storyPickFile">Photo ou vidéo</button><button type="button" id="storyUseCamera">Caméra MyEvent</button><button type="button" id="storyCloseSheet">Fermer</button><p id="storyCreateStatus" role="status"></p></div>';
    document.body.append(sheet);
    $('storyCloseSheet').onclick=()=>sheet.hidden=true;
    $('storyPickFile').onclick=()=>$('storyFile').click();
    $('storyUseCamera').onclick=()=>{storyMode=true;sheet.hidden=true; $('socialBottomCreate')?.click();};
    $('storyFile').onchange=async e=>{const file=e.target.files?.[0]; if(!file)return;
      $('storyCreateStatus').textContent='Publication…';
      try { await publishStory(file); sheet.hidden=true; } catch(err) {$('storyCreateStatus').textContent=err.message;}
      e.target.value=''; };
    $('socialCreateStory')?.addEventListener('click',createStory);
    // Capture phase routes the existing camera's Publish button to Story while in Story mode.
    $('cameraPublishBtn')?.addEventListener('click',async e=>{
      if(!storyMode)return; e.stopImmediatePropagation(); e.preventDefault();
      const src=$('myeventCapturedImage')?.src; if(!src?.startsWith('data:image/'))return;
      const button=$('cameraPublishBtn'); button.disabled=true;
      try {const file=new File([await(await fetch(src)).blob()],'story.jpg',{type:'image/jpeg'});
        await publishStory(file); storyMode=false; $('cameraCloseBtn')?.click();
      } catch(err) {alert('Story impossible : '+err.message);} finally {button.disabled=false;}
    },true);
    $('myeventCameraModal')?.addEventListener('camera-closed',()=>{storyMode=false;});
  }
  function ensureMemberProfileSheet() {
    let sheet=$('memberFriendProfileSheet');
    if(sheet)return sheet;
    sheet=document.createElement('div');sheet.id='memberFriendProfileSheet';sheet.className='memberFriendProfileSheet';sheet.hidden=true;
    sheet.innerHTML='<div class="memberFriendProfileCard" role="dialog" aria-modal="true" aria-labelledby="memberFriendProfileName"><button type="button" class="memberFriendProfileClose" aria-label="Fermer">×</button><div class="memberFriendProfileAvatar"></div><strong id="memberFriendProfileName"></strong><span class="memberFriendProfileRole"></span><small class="memberFriendProfileIdentity"></small><div class="memberFriendProfileActions"></div><p class="memberFriendProfileStatus" role="status"></p></div>';
    document.body.append(sheet);
    sheet.querySelector('.memberFriendProfileClose').onclick=()=>{sheet.hidden=true;};
    sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.hidden=true;});
    return sheet;
  }
  async function openMemberProfile(detail) {
    const {sb,user}=context();if(!sb||!user||!detail?.id)return;
    const sheet=ensureMemberProfileSheet(),avatarHost=sheet.querySelector('.memberFriendProfileAvatar'),actions=sheet.querySelector('.memberFriendProfileActions'),message=sheet.querySelector('.memberFriendProfileStatus');
    sheet.querySelector('#memberFriendProfileName').textContent=detail.name||'Membre MyEvent';
    sheet.querySelector('.memberFriendProfileRole').textContent=detail.role||'Participant';
    sheet.querySelector('.memberFriendProfileIdentity').textContent=(detail.username?'@'+detail.username+' · ':'')+'Compte '+detail.id+(detail.eventId?' · Événement '+detail.eventId:'');
    avatarHost.replaceChildren();
    if(detail.avatar&&/^https:\/\//.test(detail.avatar)){const img=document.createElement('img');img.src=detail.avatar;img.alt='';avatarHost.append(img);}else avatarHost.textContent='👤';
    actions.replaceChildren();message.textContent='';sheet.hidden=false;
    if(detail.id===user.id||detail.self){message.textContent='C’est votre profil.';return;}
    if(detail.eventId&&detail.ownerId===user.id&&detail.id!==detail.ownerId&&detail.hasProfile&&detail.username){
      const promote=document.createElement('button');promote.type='button';
      const enabled=detail.rawRole==='coorganizer';
      promote.textContent=enabled?'Retirer le rôle de co-organisateur':'Nommer co-organisateur';
      promote.onclick=async()=>{promote.disabled=true;
        try{check(await sb.rpc('set_event_coorganizer_verified',{p_event_id:detail.eventId,p_user_id:detail.id,p_username:detail.username,p_enabled:!enabled}));
          await window.myeventRefreshEventMembers?.();sheet.hidden=true;
        }catch(error){message.textContent=error.message||String(error);promote.disabled=false;}
      };actions.append(promote);
    }
    if(detail.eventId&&detail.ownerId===user.id&&!detail.hasProfile){
      message.textContent='Profil absent : ce compte ne peut pas recevoir de nouveaux droits.';
      if(detail.rawRole==='coorganizer'){
        const demote=document.createElement('button');demote.type='button';demote.textContent='Retirer ce rôle non identifié';
        demote.onclick=async()=>{demote.disabled=true;
          try{check(await sb.rpc('set_event_coorganizer',{p_event_id:detail.eventId,p_user_id:detail.id,p_enabled:false}));
            await window.myeventRefreshEventMembers?.();sheet.hidden=true;
          }catch(error){message.textContent=error.message||String(error);demote.disabled=false;}
        };actions.append(demote);
      }
    }
    if(detail.eventId&&detail.canManage&&detail.id!==detail.ownerId
      &&(detail.rawRole!=='coorganizer'||detail.ownerId===user.id)){
      const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Retirer de l’événement';
      remove.onclick=async()=>{
        if(!confirm('Retirer ce participant de l’événement ?'))return;
        remove.disabled=true;
        try{check(await sb.rpc('remove_event_participant',{p_event_id:detail.eventId,p_user_id:detail.id}));
          await window.myeventRefreshEventMembers?.();sheet.hidden=true;
        }catch(error){message.textContent=error.message||String(error);remove.disabled=false;}
      };actions.append(remove);
    }
    try{
      const result=await sb.from('friendships').select('user_low,user_high,requester,status').or(`user_low.eq.${detail.id},user_high.eq.${detail.id}`);
      if(result.error)throw result.error;
      const relation=(result.data||[]).find(r=>(r.user_low===user.id&&r.user_high===detail.id)||(r.user_high===user.id&&r.user_low===detail.id));
      const addButton=(label,action,className='')=>{
        const button=document.createElement('button');button.type='button';button.textContent=label;if(className)button.className=className;
        button.onclick=async()=>{button.disabled=true;try{check(await sb.rpc('friend_action',{other_id:detail.id,action}));await loadFriends();await loadStories();await openMemberProfile(detail);}catch(e){message.textContent=e.message||'Action impossible.';button.disabled=false;}};
        actions.append(button);
      };
      if(!relation){addButton('＋ Ajouter en ami','send','primary');return;}
      if(relation.status==='accepted'){
        message.textContent='✓ Vous êtes déjà amis.';
        const write=document.createElement('button');write.type='button';write.textContent='💬 Envoyer un message';
        write.onclick=()=>{sheet.hidden=true;window.myeventSocialInbox?.openPeer(detail.id);};actions.append(write);return;
      }
      if(relation.requester===user.id){message.textContent='Demande d’ami envoyée.';return;}
      addButton('Accepter','accept','primary');addButton('Refuser','decline','danger');
    }catch(e){message.textContent='Impossible de charger la relation d’amitié : '+(e.message||String(e));}
  }
  window.addEventListener('myevent-open-member-profile',e=>openMemberProfile(e.detail));
  function scheduleRefresh() {clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{loadFriends();loadStories();},250);}
  function start() {
    const {sb,user}=context(); if(!sb || !user || activeId===user.id)return;
    if(channel)sb.removeChannel(channel); activeId=user.id; relations=[];
    loadFriends().then(inspectInvitation);loadStories();
    channel=sb.channel('social-'+user.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'friendships'},scheduleRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'social_stories'},scheduleRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'social_story_likes'},()=>{
        const viewer=$('socialStoryViewer'),item=storyRows[viewerIndex];
        if(viewer&&!viewer.hidden&&item)refreshStoryLike(item.id);
      }).subscribe();
  }
  setupCreation(); initializeViewer();
  const myStoryShortcut=$('socialMyStory');
  myStoryShortcut?.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(e.target.closest('.storyAddBadge')){createStory();return;}
    const userId=context().user?.id;
    const mine=storyRows.map((r,i)=>({r,i})).filter(x=>x.r.author_id===userId&&Date.parse(x.r.expires_at)>Date.now());
    if(mine.length)showStory(mine[mine.length-1].i);else createStory();
  });

  $('friendStoriesSeeAll')?.addEventListener('click',()=>{
    $('socialFriendsShortcut')?.click();
  });
  document.querySelector('#socialFriendsView .socialSearch button')?.addEventListener('click',searchUsers);
  document.querySelector('#socialFriendsView .socialSearch input')?.addEventListener('keydown',e=>{if(e.key==='Enter')searchUsers();});
  $('invitePhoneContactsBtn')?.addEventListener('click',prepareInvitation);
  $('socialFriendInviteShareBtn')?.addEventListener('click',shareInvitation);
  $('socialFriendInviteAccept')?.addEventListener('click',acceptInvitation);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && activeId)scheduleRefresh();});
  setInterval(()=>{const {sb,user}=context();if((!user || user.id!==activeId) && activeId){channel&&sb?.removeChannel(channel);channel=null;activeId=null;relations=[];clearTimeout(stripExpiryTimer);storyRows.forEach(r=>URL.revokeObjectURL(r.url));storyRows=[];showMyStoryThumbnail(null);closeViewer();}
    if(user)start();},1000);
  setInterval(()=>{if(activeId){loadFriends();loadStories();}},60000);
  // Aggregates can change through friends' likes even when their individual rows are hidden by RLS.
  setInterval(()=>{const viewer=$('socialStoryViewer'),item=storyRows[viewerIndex];
    if(activeId&&!document.hidden&&viewer&&!viewer.hidden&&item)refreshStoryLike(item.id);
  },15000);
})();
