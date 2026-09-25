/* Social friends and 24-hour stories. Uses the existing authenticated Supabase client. */
(() => {
  const $ = id => document.getElementById(id);
  const context = () => window.myeventCameraContext?.() || {};
  let activeId = null, channel = null, refreshTimer = null, storyTimer = null;
  let storyRows = [], viewerIndex = 0, storyMode = false, startedAt = 0;
  const myStoryBubble = $('socialMyStory')?.querySelector('.socialStoryBubble');
  const defaultMyStoryContent = [...(myStoryBubble?.childNodes || [])].map(node => node.cloneNode(true));
  let thumbnailExpiryTimer = null;
  function showMyStoryThumbnail(userId) {
    if (!myStoryBubble) return;
    clearTimeout(thumbnailExpiryTimer);
    const latest = storyRows.filter(r => r.author_id === userId && Date.parse(r.expires_at) > Date.now())
      .reduce((best, r) => !best || Date.parse(r.created_at) > Date.parse(best.created_at) ? r : best, null);
    const me = $('socialMyStory');
    me.classList.toggle('hasStory', !!latest);
    if (!latest) {
      myStoryBubble.replaceChildren(...defaultMyStoryContent.map(node => node.cloneNode(true)));
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
  const avatar = p => {
    const el = document.createElement('div'); el.className = 'socialPostAvatar';
    if (p?.avatar && /^https:\/\//.test(p.avatar)) {
      const img = document.createElement('img'); img.src = p.avatar; img.alt = ''; el.append(img);
    } else el.textContent = '👤';
    return el;
  };
  function person(container, profile, label, action) {
    const row = document.createElement('div'); row.className = 'socialPerson'; row.append(avatar(profile));
    const name = document.createElement('b'); name.className = 'grow'; name.textContent = profileName(profile); row.append(name);
    if (action) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => mutate(profile.id, action, button)); row.append(button);
    }
    container.append(row);
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
      for (const r of relations) {
        const id = r.user_low === user.id ? r.user_high : r.user_low, p = profiles.get(id) || {id};
        if (r.status === 'accepted') person($('socialFriendList'),p,'Supprimer','remove');
        else if (r.requester === user.id) person($('socialFriendOutgoing'),p,'Annuler','cancel');
        else {
          person($('socialFriendIncoming'),p,'Accepter','accept');
          person($('socialFriendIncoming'),p,'Refuser','decline');
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
    el.innerHTML = '<div class="storyProgress"><span></span></div><div class="storyHeader"><b></b><button type="button" data-story="close" aria-label="Fermer">✕</button></div><div class="storyMedia"></div><p class="storyCaption"></p><button type="button" class="storyPrevious" data-story="previous" aria-label="Story précédente">‹</button><button type="button" class="storyNext" data-story="next" aria-label="Story suivante">›</button><button type="button" class="storyDelete" data-story="delete">Supprimer</button>';
    document.body.append(el);
    el.addEventListener('click', e => { const action = e.target.closest('[data-story]')?.dataset.story;
      if(action === 'close') closeViewer(); if(action === 'previous') showStory(viewerIndex - 1);
      if(action === 'next') showStory(viewerIndex + 1); if(action === 'delete') deleteStory(); });
    let touchX = 0; el.addEventListener('touchstart',e => { touchX=e.changedTouches[0].clientX; },{passive:true});
    el.addEventListener('touchend',e => {const diff=e.changedTouches[0].clientX-touchX;
      if(Math.abs(diff)>60) showStory(viewerIndex+(diff<0?1:-1));},{passive:true});
    document.addEventListener('keydown',e => {if(el.hidden)return;
      if(e.key==='Escape')closeViewer(); if(e.key==='ArrowRight')showStory(viewerIndex+1);
      if(e.key==='ArrowLeft')showStory(viewerIndex-1); });
  }
  function closeViewer() { clearTimeout(storyTimer); const el=$('socialStoryViewer'); el.hidden=true; el.querySelector('.storyMedia').replaceChildren(); document.body.style.overflow=''; }
  function showStory(index) {
    if(index < 0 || index >= storyRows.length) { closeViewer(); return; }
    clearTimeout(storyTimer); viewerIndex=index; startedAt=Date.now();
    const item=storyRows[index], el=$('socialStoryViewer'); el.hidden=false; document.body.style.overflow='hidden';
    el.querySelector('.storyHeader b').textContent=profileName(item.profile);
    el.querySelector('.storyCaption').textContent=item.caption || '';
    el.querySelector('.storyDelete').hidden=item.author_id!==context().user?.id;
    const media=document.createElement(item.media_type==='video'?'video':'img'); media.src=item.url;
    if(item.media_type==='video') { media.autoplay=true; media.playsInline=true; media.addEventListener('ended',()=>showStory(viewerIndex+1),{once:true}); }
    el.querySelector('.storyMedia').replaceChildren(media);
    const progress=el.querySelector('.storyProgress span'); progress.style.width='0%';
    const tick=()=>{if(el.hidden)return; const duration=item.media_type==='video' ? Math.min(30000,media.duration*1000||15000) : 5000;
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
      previous.forEach(r=>URL.revokeObjectURL(r.url));
      const strip=document.querySelector('#socialHome .socialStories');
      strip.querySelectorAll('.socialStory[data-story-author]').forEach(x=>x.remove());
      showMyStoryThumbnail(user.id);
      const me=$('socialMyStory');
      me.onclick=()=>{const i=storyRows.findIndex(r=>r.author_id===user.id);if(i>=0)showStory(i);else createStory();};
      const seen=new Set(); storyRows.forEach((r,i)=>{
        if(r.author_id===user.id||seen.has(r.author_id))return; seen.add(r.author_id);
        const bubble=document.createElement('button'); bubble.type='button'; bubble.className='socialStory hasStory';
        bubble.dataset.storyAuthor=r.author_id; const a=document.createElement('div'); a.className='socialStoryBubble'; a.append(avatar(r.profile));
        const label=document.createElement('div'); label.textContent=profileName(r.profile); bubble.append(a,label);
        bubble.onclick=()=>showStory(i); strip.insertBefore(bubble,strip.children[2]);
      });
    } catch(e) { console.warn('Stories indisponibles',e); }
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
  function scheduleRefresh() {clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{loadFriends();loadStories();},250);}
  function start() {
    const {sb,user}=context(); if(!sb || !user || activeId===user.id)return;
    if(channel)sb.removeChannel(channel); activeId=user.id;
    loadFriends();loadStories();
    channel=sb.channel('social-'+user.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'friendships'},scheduleRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'social_stories'},scheduleRefresh).subscribe();
  }
  setupCreation(); initializeViewer();
  document.querySelector('#socialFriendsView .socialSearch button')?.addEventListener('click',searchUsers);
  document.querySelector('#socialFriendsView .socialSearch input')?.addEventListener('keydown',e=>{if(e.key==='Enter')searchUsers();});
  setInterval(()=>{const {sb,user}=context();if((!user || user.id!==activeId) && activeId){channel&&sb?.removeChannel(channel);channel=null;activeId=null;relations=[];storyRows.forEach(r=>URL.revokeObjectURL(r.url));storyRows=[];showMyStoryThumbnail(null);closeViewer();}
    if(user)start();},1000);
  setInterval(()=>{if(activeId){loadFriends();loadStories();}},60000);
})();
