/* ===== original inline script 23 ===== */
(function(){
  function $s(id){return document.getElementById(id)}
  const nav=$s('socialNav')||$s('socialBottomNav');
  const views={feed:$s('socialFeedView'),discover:$s('socialDiscoverView'),friends:$s('socialFriendsView'),messages:$s('socialMessagesView'),notifications:$s('socialGlobalNotificationsView')};
  function tab(name){Object.keys(views).forEach(k=>{if(views[k])views[k].classList.toggle('open',k!=='feed'&&false)});if(views.feed)views.feed.style.display=name==='feed'?'block':'none';if(views.discover)views.discover.style.display=name==='discover'?'block':'none';if(views.friends)views.friends.style.display=name==='friends'?'block':'none';if(views.messages)views.messages.style.display=name==='messages'?'block':'none';document.querySelectorAll('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===name));}
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-social-tab]');if(b)tab(b.dataset.socialTab)});
  // V54.46 — raccourcis du cadre Mes événements
  $s('socialHeaderMusicBtn')?.addEventListener('click',()=>document.querySelector('#socialBottomNav .navMusic')?.click());
  const headerEvents=$s('socialHeaderEventsBtn');
  headerEvents?.addEventListener('click',()=>{const el=$s('eventsCard');if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'})}});
  $s('socialHeaderCallBtn')?.addEventListener('click',()=>{const el=$s('groupCallCard');if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{if(typeof callActive!=='undefined' && !callActive)$s('startCallBtn')?.click()},250);}});
  $s('socialHeaderNotificationsBtn')?.addEventListener('click',()=>tab('notifications'));
  $s('socialHeaderMessagesBtn')?.addEventListener('click',()=>tab('messages'));
  $s('socialHeaderSearchBtn')?.addEventListener('click',()=>{tab('discover');setTimeout(()=>{$s('socialSearchInput')?.focus();},50);});
  $s('socialFriendsShortcut')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();tab('friends');setTimeout(()=>views.friends?.scrollIntoView({block:'start'}),20);});
  $s('socialStoriesShortcut')?.addEventListener('click',()=>{
    const section=$s('friendStoriesSection'),button=$s('socialStoriesShortcut');
    if(!section)return;
    section.hidden=!section.hidden;
    button.setAttribute('aria-expanded',String(!section.hidden));
  });
  // Story creation is handled by social-friends-stories.js.
  $s('socialBottomCreate')?.addEventListener('click',()=>openMyEventCamera());
  $s('socialBottomNav')?.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab]');if(!b)return;const t=b.dataset.bottomTab;if(t==='music')return;if(t==='games'){globalThis.myeventEntertainment?.open?.();return}if(t==='profile'){$s('profileAvatar')?.click();return}if(t==='events'){tab('feed');const el=$s('eventsCard');if(el){el.open=true;setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),20);} $s('socialBottomNav').querySelectorAll('[data-bottom-tab]').forEach(x=>x.classList.toggle('active',x===b));return;}tab(t==='feed'?'feed':t);$s('socialBottomNav').querySelectorAll('[data-bottom-tab]').forEach(x=>x.classList.toggle('active',x===b));});
  const popularShortcut=document.querySelector('#socialHome .popularCard');
  popularShortcut?.addEventListener('click',()=>{
    const filters=[...document.querySelectorAll('#socialHome .socialFilter')];
    filters.forEach(x=>x.classList.remove('active'));
    const target=filters.find(x=>x.textContent.trim()==='Pour vous');
    target?.classList.add('active');
    $s('socialFeedView')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.querySelectorAll('.socialFilter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.socialFilter').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
  $s('socialCreateEventBtn')?.addEventListener('click',()=>{$s('createEventInlineBtn')?.click();window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})});
  $s('socialExploreBtn')?.addEventListener('click',()=>{tab('discover');setTimeout(()=>window.scrollTo({top:$s('socialHome').offsetTop,behavior:'smooth'}),20)});
  $s('socialSoloBtn')?.addEventListener('click',()=>{tab('feed');$s('socialOpenComposer')?.click();$s('socialPostText').value='🤝 Je cherche des participants pour une sortie !\n\n📍 Lieu :\n📅 Date :\n🎯 Activité :\n👥 Places disponibles :';$s('socialPostText').focus()});
  $s('socialOpenComposer')?.addEventListener('click',()=>{$s('socialComposerPanel').classList.add('open');$s('socialPostText').focus()});
  $s('socialCancelPostBtn')?.addEventListener('click',()=>{$s('socialComposerPanel').classList.remove('open');$s('socialPostMsg').textContent=''});
  $s('socialPublishBtn')?.addEventListener('click',async()=>{
    const text=($s('socialPostText').value||'').trim(),context=window.myeventCameraContext?.();
    if(!text){$s('socialPostMsg').textContent='Écris quelque chose avant de publier.';return;}
    if(!context?.user){$s('socialPostMsg').textContent='Connecte-toi pour publier.';return;}
    const button=$s('socialPublishBtn');button.disabled=true;
    try{const result=await context.sb.from('event_feed_posts').insert({author_id:context.user.id,body:text});
      if(result.error)throw result.error;
      $s('socialPostText').value='';$s('socialComposerPanel').classList.remove('open');
      $s('socialPostMsg').textContent='Publié.';await window.myeventRefreshSocialFeed?.();
    }catch(error){$s('socialPostMsg').textContent='Publication impossible : '+(error.message||String(error));}
    finally{button.disabled=false;}
  });
  document.addEventListener('click',e=>{
    const like=e.target.closest('.socialLikeBtn');if(like){window.myeventFeedInteractions?.mutate(like.closest('.socialPost'),'like',like);return}
    const comment=e.target.closest('.socialCommentBtn');if(comment){comment.closest('.socialPost').querySelector('.socialCommentBox').classList.toggle('open');return}
    const interest=e.target.closest('.socialInterestBtn');if(interest){interest.textContent='✅ Intérêt enregistré';interest.classList.add('active');return}
    const follow=e.target.closest('.socialFollowBtn');if(follow){$s('socialFriendsShortcut')?.click();const input=document.querySelector('#socialFriendsView .socialSearch input');if(input)input.focus();const notice=$s('socialFriendStatus');if(notice)notice.textContent='Recherche la personne dans Amis pour lui envoyer une vraie demande.';return}
    const share=e.target.closest('.socialShareBtn');if(share){if(navigator.share){navigator.share({title:'MyEvent',text:'Découvre cet événement sur MyEvent'}).catch(()=>{})}else{navigator.clipboard?.writeText(location.href);share.textContent='✓ Lien copié'}return}
    const send=e.target.closest('.socialCommentBox button:not(.socialCommentDelete)');if(send){window.myeventFeedInteractions?.mutate(send.closest('.socialPost'),'send',send);return}
    const removeComment=e.target.closest('.socialCommentDelete');if(removeComment){window.myeventFeedInteractions?.mutate(removeComment.closest('.socialPost'),'delete',removeComment);return}
    const msg=e.target.closest('.socialMessageBtn');if(msg){
      const post=msg.closest('.socialPost');
      const peerId=msg.dataset.userId||msg.dataset.authorId||post?.dataset.userId||post?.dataset.authorId||post?.dataset.author;
      if(peerId&&window.myeventSocialInbox?.openPeer){window.myeventSocialInbox.openPeer(peerId);return}
      if(window.myeventSocialInbox?.open){window.myeventSocialInbox.open('messages');return}
      tab('messages');return
    }
    const view=e.target.closest('.socialViewEventBtn');if(view){window.myeventViewSocialEvent?.(view.dataset.eventId);return}
  });
  $s('socialSearchBtn')?.addEventListener('click',()=>{const q=($s('socialSearchInput').value||'').toLowerCase().trim();document.querySelectorAll('#socialDiscoverList .socialEventCard').forEach(c=>c.style.display=(!q||c.textContent.toLowerCase().includes(q))?'block':'none')});
  // Camera controls reuse the existing capture and filter actions.
  let timerSeconds=0,cameraRatio='9:16',countdownToken=0,levelActive=false;
  const cameraSheet=$s('myeventCameraModal')?.querySelector('.cameraProSheet');
  function applyCameraRatio(){
    const [w,h]=cameraRatio.split(':').map(Number),aspect=w/h;
    const vw=window.visualViewport?.width||innerWidth,vh=window.visualViewport?.height||innerHeight;
    let width=vw,height=width/aspect;
    if(height>vh){height=vh;width=height*aspect;}
    cameraSheet?.style.setProperty('--camera-frame-width',Math.round(width)+'px');
    cameraSheet?.style.setProperty('--camera-frame-height',Math.round(height)+'px');
    const ratioButton=$s('cameraRatioSide');
    ratioButton?.setAttribute('aria-label','Ratio '+cameraRatio);
    ratioButton?.setAttribute('data-ratio',cameraRatio);
    $s('myeventCameraModal')?.dispatchEvent(new Event('camera-framing-change'));
  }
  window.addEventListener('resize',applyCameraRatio);applyCameraRatio();
  function setCameraLevelState(active){
    levelActive=!!active;
    const button=$s('cameraLevelSide'),indicator=$s('cameraLevelIndicator');
    button?.classList.toggle('active',levelActive);
    button?.setAttribute('aria-pressed',levelActive?'true':'false');
    if(indicator)indicator.hidden=!levelActive;
    if(!levelActive)window.removeEventListener('deviceorientation',onCameraOrientation);
  }
  function onCameraOrientation(e){
    if(!levelActive)return;
    const indicator=$s('cameraLevelIndicator');
    if(!indicator)return;
    const angle=screen.orientation?.angle??window.orientation??0;
    const raw=(angle===90||angle===-90)?e.beta:e.gamma;
    if(typeof raw!=='number'||!Number.isFinite(raw)){indicator.classList.add('unavailable');indicator.setAttribute('aria-label','Niveau indisponible');return;}
    const tilt=Math.max(-45,Math.min(45,raw));
    const aligned=Math.abs(raw)<2;
    indicator.classList.remove('unavailable');
    indicator.removeAttribute('data-message');
    indicator.setAttribute('aria-label',aligned?'Appareil à niveau':'Inclinaison '+Math.round(raw)+' degrés');
    indicator.style.setProperty('--level-angle',tilt+'deg');
    indicator.classList.toggle('aligned',aligned);
  }
  async function toggleCameraLevel(){
    const button=$s('cameraLevelSide'),indicator=$s('cameraLevelIndicator');
    if(levelActive){setCameraLevelState(false);return;}
    if(typeof DeviceOrientationEvent==='undefined'||!window.isSecureContext){
      setCameraLevelState(false);
      if(indicator){indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','Niveau indisponible sur cet appareil');}
      return;
    }
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      try{
        if(await DeviceOrientationEvent.requestPermission()!=='granted'){
          setCameraLevelState(false);
          if(indicator){indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','Autorisation du niveau refusée');}
          return;
        }
      }catch(e){
        setCameraLevelState(false);
        if(indicator){indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','Autorisation du niveau indisponible');}
        return;
      }
    }
    setCameraLevelState(true);
    if(indicator){indicator.classList.add('unavailable');indicator.setAttribute('data-message','En attente du capteur d’orientation');}
    window.addEventListener('deviceorientation',onCameraOrientation);
  }
  function cancelCountdown(){countdownToken++;const el=$s('cameraCountdown');if(el){el.hidden=true;el.textContent='';}}
  const cameraZoom=(function(){
    const sheet=$s('myeventCameraModal')?.querySelector('.cameraProSheet');
    const video=$s('myeventCameraVideo');
    const preview=sheet?.querySelector('.cameraProPreview'), indicator=$s('cameraZoomIndicator');
    let factor=1, track=null, hardware=false, startDistance=0, startFactor=1, hideTimer, zoomRequest=0;
    const zoomControls=document.createElement('div');zoomControls.className='cameraZoomChoices';zoomControls.setAttribute('aria-label','Zoom');
    for(const value of [1,2,3]){const button=document.createElement('button');button.type='button';button.textContent=value+'×';button.dataset.zoom=String(value);button.onclick=()=>set(value);zoomControls.append(button);}sheet?.append(zoomControls);
    const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    function display(){
      const bounds=zoomBounds(),videoMode=$s('myeventCameraModal').dataset.captureMode==='video';
      zoomControls.hidden=videoMode&&!hardware;
      zoomControls.querySelectorAll('button').forEach(button=>{const value=Number(button.dataset.zoom);button.hidden=value<bounds.min||value>bounds.max;button.setAttribute('aria-pressed',String(Math.abs(factor-value)<.1));});
      if(!indicator)return;
      indicator.textContent=factor.toFixed(1)+'×';indicator.classList.add('visible');
      clearTimeout(hideTimer);hideTimer=setTimeout(()=>indicator.classList.remove('visible'),850);
    }
    function zoomBounds(){
      if(hardware&&track?.readyState==='live'){
        try{
          const z=track.getCapabilities?.().zoom;
          if(z&&Number.isFinite(z.min)&&Number.isFinite(z.max))return {min:z.min,max:z.max};
        }catch(e){}
      }
      return {min:1,max:$s('myeventCameraModal').dataset.captureMode==='video'?1:3};
    }
    function set(value){
      const bounds=zoomBounds();
      factor=Math.min(bounds.max,Math.max(bounds.min,value));display();
      $s('myeventCameraModal')?.dispatchEvent(new Event('camera-framing-change'));
      if(hardware&&track?.readyState==='live'){
        const request=++zoomRequest;
        track.applyConstraints({advanced:[{zoom:factor}]}).then(()=>{
          if(request===zoomRequest&&video)video.style.transform='none';
        }).catch(()=>{hardware=false;factor=Math.min(3,Math.max(1,factor));if(video)video.style.transform=`scale(${factor})`;});
      }else if(video)video.style.transform=`scale(${factor})`;
    }
    preview?.addEventListener('touchstart',e=>{
      if($s('myeventCameraModal').cameraHasPhoto?.()||e.touches.length!==2||e.target.closest('button, input, .cameraCreativePanel'))return;
      startDistance=distance(e.touches);startFactor=factor;e.preventDefault();
    },{passive:false});
    preview?.addEventListener('touchmove',e=>{
      if(e.touches.length!==2||!startDistance)return;
      e.preventDefault();set(startFactor*distance(e.touches)/startDistance);
    },{passive:false});
    preview?.addEventListener('touchend',e=>{if(e.touches.length<2)startDistance=0;});
    let cameraMusicTrack=null,cameraMusicResults=[],cameraMusicRequest=0,cameraMusicStart=0,cameraMusicDuration=15,cameraMusicConfirmed=false,cameraMusicStopTimer=null;
    function publishCameraMusicSelection(){window.MyEventCameraMusicSelection=cameraMusicConfirmed&&cameraMusicTrack?{track:cameraMusicTrack,start_seconds:cameraMusicStart,duration_seconds:cameraMusicDuration}:null;window.dispatchEvent(new CustomEvent('camera-music-change',{detail:window.MyEventCameraMusicSelection}));}
    function clearCameraMusic(){clearTimeout(cameraMusicStopTimer);window.MyEventMusicPlayback?.stop();cameraMusicTrack=null;cameraMusicResults=[];cameraMusicStart=0;cameraMusicDuration=15;cameraMusicConfirmed=false;publishCameraMusicSelection();$s('cameraMusicSide')?.classList.remove('active');}
    function setCameraMusic(track){cameraMusicTrack=track||null;cameraMusicStart=0;cameraMusicDuration=15;cameraMusicConfirmed=false;publishCameraMusicSelection();$s('cameraMusicSide')?.classList.toggle('active',!!track);}
    async function searchCameraMusic(query,results,note){
      const q=query.trim();if(q.length<2){note.textContent='Écris au moins 2 caractères.';return;}
      const ticket=++cameraMusicRequest;note.textContent='Recherche MyEvent Music…';
      try{const r=await fetch('/api/search-music?q='+encodeURIComponent(q)),data=await r.json();if(!r.ok)throw new Error(data.error||'Recherche indisponible');if(ticket!==cameraMusicRequest)return;
        cameraMusicResults=data.items||[];results.replaceChildren();
        cameraMusicResults.forEach(track=>{const b=document.createElement('button');b.type='button';b.className='storyMusicResult';
          const img=document.createElement('img');img.src=track.thumbnail_url||'';img.alt='';const meta=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=track.title||'Morceau';small.textContent=track.artist||'';meta.append(strong,small);b.append(img,meta);
          b.addEventListener('click',()=>{setCameraMusic(track);window.MyEventMusicPlayback?.select(track,[track]);closePanel();openPanel('music',$s('cameraMusicSide'));});results.appendChild(b);});
        note.textContent=cameraMusicResults.length?cameraMusicResults.length+' résultat(s) MyEvent Music':'Aucun résultat.';
      }catch(error){note.textContent='Musique : '+error.message;}
    }
    const panel=$s('cameraCreativePanel'), content=$s('cameraPanelContent'), title=$s('cameraPanelTitle');
    const buttons=['cameraAiSide','cameraBeautySide','cameraRetouchSide','cameraFilterSide','cameraAppearanceSide','cameraStickerSide','cameraSignatureSide','cameraFrameSide','cameraTextSide','cameraMusicSide','cameraTimerSide','cameraRatioSide','cameraSettingsBtn'];
    function closePanel(){
      if(panel)panel.hidden=true;
      buttons.forEach(id=>{const b=$s(id);b?.classList.remove('active');b?.setAttribute('aria-expanded','false');});
    }
    function openPanel(kind,source){
      if(!panel||!content)return;
      if(!panel.hidden&&panel.dataset.kind===kind){closePanel();return;}
      $s('myeventCameraModal').cameraResumeEdit?.();
      closePanel();const settings=sheet?.querySelector('.cameraGlassSettings');if(settings)settings.open=false;panel.hidden=false;panel.dataset.kind=kind;
      source?.classList.add('active');source?.setAttribute('aria-expanded','true');
      const names={ai:'IA photo',beauty:'Beauté',retouch:'Retouches',filters:'Filtres créatifs',appearance:'Effets amusants 🤩',signatures:'Signatures MyEvent ✍️',frames:'Cadres photo',text:'Texte',stickers:'Texte & stickers',music:'Ajouter un son',timer:'Minuteur',ratio:'Cadrage',settings:'Réglages',plus:'Plus · Outils créatifs'};
      title.textContent=names[kind];
      content.replaceChildren();
      if(cameraMode==='video'||cameraVideoFile){
        if(['filters','beauty','retouch','appearance','stickers','signatures','frames','text','ai'].includes(kind)){content.textContent='Ces retouches sont disponibles pour les photos. Les effets vidéo sont à venir.';return;}
      }
      if(kind==='frames'){$s('myeventCameraModal').cameraRenderFrames?.(content);return;}
      if(kind==='text'){$s('myeventCameraModal').cameraRenderText?.(content);return;}
      if(kind==='signatures'){$s('myeventCameraModal').cameraRenderSignatures?.(content);return;}
      if(kind==='stickers'){$s('myeventCameraModal').cameraRenderStickers?.(content);return;}
      if(kind==='gallery'){$s('myeventCameraModal').cameraRenderGallery?.(content);return;}
      if(kind==='settings'||kind==='plus'){
        const row=document.createElement('div');row.className='cameraPanelChoices';
        const actions=kind==='settings'?[['Flash','cameraFlashBtn'],['Minuteur','cameraTimerSide'],['Ratio','cameraRatioSide'],['Grille','cameraGridSide'],['Niveau','cameraLevelSide'],['Qualité','cameraQualityBtn']]:[['Cadres','cameraFrameSide'],['Texte & stickers','cameraStickerSide'],['Filtres','cameraFilterSide'],['Retouches','cameraRetouchSide'],['Beauté','cameraBeautySide'],['Effets amusants','cameraAppearanceSide'],['Musique','cameraMusicSide']];
        actions.forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=!!$s(id)?.disabled||(cameraMode==='video'&&['cameraTimerSide','cameraRatioSide'].includes(id));b.onclick=()=>{closePanel();$s(id)?.click();};row.append(b);});content.append(row);
        const note=document.createElement('p');note.textContent=kind==='plus'?'Décore et transforme tes photos. Portrait utilise la détection du visage, sans flou de profondeur. Les vidéos sont enregistrées sans effets photo.':'Pince pour zoomer : zoom matériel selon l’appareil, sinon recadrage numérique pour les photos. La vidéo conserve le cadrage natif.';content.append(note);
        if(kind==='settings'){const settings=$s('myeventCameraModal').cameraSettingsElement;if(settings){settings.open=true;content.append(settings);}}
        return;
      }
      if(kind==='filters'){$s('myeventCameraModal').cameraRenderFilters?.(content);return;}
      if(kind==='beauty'){
        const modal=$s('myeventCameraModal'),current=modal.cameraGetBeauty?.()??0;
        const note=document.createElement('p');note.textContent='Réglage Beauté indépendant des filtres. Il ajuste progressivement lumière, contraste, saturation et chaleur.';content.appendChild(note);
        const wrap=document.createElement('label');wrap.className='cameraRetouchControl';
        wrap.innerHTML='<span>Intensité <output>'+Math.round(current)+'</output>%</span><input type="range" min="0" max="100" value="'+current+'" step="1">';
        const input=wrap.querySelector('input'),out=wrap.querySelector('output');
        input.addEventListener('input',()=>{out.textContent=input.value;modal.cameraSetBeauty?.(Number(input.value));});
        content.appendChild(wrap);
        const row=document.createElement('div');row.className='cameraPanelChoices';
        [['0','Désactivé'],['35','Naturel'],['65','Doux']].forEach(([value,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{input.value=value;out.textContent=value;modal.cameraSetBeauty?.(Number(value));});row.appendChild(b);});
        content.appendChild(row);return;
      }
      if(kind==='retouch'){
        const modal=$s('myeventCameraModal'),state=modal.cameraGetRetouch?.()||{brightness:100,contrast:100,saturate:100,warmth:0};
        const note=document.createElement('p');note.textContent='Réglages indépendants conservés pendant la session et intégrés à la photo finale.';content.appendChild(note);
        const controls=[['brightness','Luminosité',70,130],['contrast','Contraste',70,140],['saturate','Saturation',0,160],['warmth','Chaleur',-40,40]];
        controls.forEach(([key,label,min,max])=>{
          const value=state[key],wrap=document.createElement('label');wrap.className='cameraRetouchControl';
          wrap.innerHTML='<span>'+label+' <output>'+value+'</output></span><input type="range" min="'+min+'" max="'+max+'" value="'+value+'" step="1">';
          const input=wrap.querySelector('input'),out=wrap.querySelector('output');
          input.addEventListener('input',()=>{out.textContent=input.value;modal.cameraSetRetouch?.(key,Number(input.value));});
          content.appendChild(wrap);
        });
        const reset=document.createElement('button');reset.type='button';reset.textContent='Réinitialiser';
        reset.addEventListener('click',()=>{modal.cameraResetRetouch?.();closePanel();openPanel('retouch',source);});
        content.appendChild(reset);return;
      }
      if(kind==='ai'){
        const modal=$s('myeventCameraModal');
        content.textContent='Chargement des filtres IA…';
        modal.cameraRenderAI?.(content);return;
      }
      if(kind==='appearance'){$s('myeventCameraModal').cameraRenderAppearance?.(content);return;}
      if(kind==='timer'||kind==='ratio'){
        const row=document.createElement('div');row.className='cameraPanelChoices';
        const options=kind==='timer'?[['0','Désactivé'],['3','3 s'],['5','5 s'],['10','10 s']]:[['9:16','9:16'],['4:3','4:3'],['1:1','1:1']];
        options.forEach(([value,label])=>{const choice=document.createElement('button');choice.type='button';choice.textContent=label;choice.classList.toggle('active',value===(kind==='timer'?String(timerSeconds):cameraRatio));choice.addEventListener('click',()=>{if(kind==='timer'){timerSeconds=Number(value);const legacy=$s('cameraTimerBtn'),side=$s('cameraTimerSide');if(legacy){legacy.dataset.timer=value;legacy.querySelector('small')&&(legacy.querySelector('small').textContent=timerSeconds?timerSeconds+' s':'Off');}if(side){side.classList.toggle('active',timerSeconds>0);side.setAttribute('aria-pressed',String(timerSeconds>0));side.setAttribute('aria-label',timerSeconds?'Minuteur '+timerSeconds+' secondes':'Minuteur désactivé');}}else{cameraRatio=value;applyCameraRatio();}closePanel();});row.appendChild(choice);});
        content.appendChild(row);return;
      }
      const descriptions={
        ai:'Traitement IA à connecter. La commande existante est disponible après une photo.',
        stickers:'Emoji · Stickers · Texte · Décorations : à venir.',
        music:'Recherche et lecture via MyEvent Music.'
      };
      const note=document.createElement('p');note.textContent=descriptions[kind];content.appendChild(note);
      if(kind==='music'){
        note.textContent='Recherche un morceau dans MyEvent Music. Aucun fichier audio local n’est nécessaire.';
        const search=document.createElement('div');search.className='cameraMusicSearch';
        const input=document.createElement('input');input.type='search';input.placeholder='Rechercher un morceau…';
        const go=document.createElement('button');go.type='button';go.textContent='Rechercher';search.append(input,go);content.appendChild(search);
        const fields=document.createElement('div');fields.className='cameraMusicFields';
        const name=document.createElement('p');name.textContent=cameraMusicTrack?(cameraMusicTrack.title||'Morceau')+(cameraMusicTrack.artist?' · '+cameraMusicTrack.artist:''):'Aucun morceau sélectionné';fields.appendChild(name);
        const excerpt=document.createElement('div');excerpt.className='storyMusicExcerpt';excerpt.hidden=!cameraMusicTrack;
        const maxStart=Math.max(0,(Number(cameraMusicTrack?.duration_seconds)||300)-5);
        excerpt.innerHTML='<label>Début de l’extrait <input data-camera-music-start type="range" min="0" max="'+maxStart+'" value="'+cameraMusicStart+'" step="1"></label><label>Durée <select data-camera-music-duration><option value="15">15 s</option><option value="30">30 s</option></select></label><strong data-camera-music-value></strong>';
        const start=excerpt.querySelector('[data-camera-music-start]'),duration=excerpt.querySelector('[data-camera-music-duration]'),value=excerpt.querySelector('[data-camera-music-value]');
        duration.value=String(cameraMusicDuration);
        const updateExcerpt=()=>{cameraMusicStart=Number(start.value)||0;cameraMusicDuration=Number(duration.value)||15;cameraMusicConfirmed=false;publishCameraMusicSelection();value.textContent='Début '+cameraMusicStart+' s · '+cameraMusicDuration+' s';};
        updateExcerpt();start.addEventListener('input',updateExcerpt);duration.addEventListener('change',updateExcerpt);fields.appendChild(excerpt);
        const preview=document.createElement('button');preview.type='button';preview.textContent='▶ Prévisualiser l’extrait';preview.disabled=!cameraMusicTrack;fields.appendChild(preview);
        const use=document.createElement('button');use.type='button';use.textContent=cameraMusicConfirmed?'✓ Son utilisé':'✓ Utiliser ce son';use.disabled=!cameraMusicTrack;fields.appendChild(use);
        const remove=document.createElement('button');remove.type='button';remove.textContent='Retirer le son';remove.hidden=!cameraMusicConfirmed;fields.appendChild(remove);content.appendChild(fields);
        const results=document.createElement('div');results.className='storyMusicResults';content.appendChild(results);
        go.addEventListener('click',()=>searchCameraMusic(input.value,results,note));input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchCameraMusic(input.value,results,note);}});
        preview.addEventListener('click',()=>{if(!cameraMusicTrack)return;updateExcerpt();const playback=window.MyEventMusicPlayback;if(!playback)return;clearTimeout(cameraMusicStopTimer);playback.select(cameraMusicTrack,[cameraMusicTrack]);playback.seekTo?.(cameraMusicStart);playback.play();cameraMusicStopTimer=setTimeout(()=>playback.stop(),cameraMusicDuration*1000);});
        use.addEventListener('click',()=>{if(!cameraMusicTrack)return;updateExcerpt();cameraMusicConfirmed=true;publishCameraMusicSelection();$s('cameraMusicSide')?.classList.add('active');closePanel();});
        remove.addEventListener('click',()=>{clearCameraMusic();closePanel();openPanel('music',$s('cameraMusicSide'));});
      }
    }
    // Delegation also covers controls created after this parser-time script executes.
    $s('myeventCameraModal').addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      const kinds={cameraAiSide:'ai',cameraFilterSide:'filters',cameraAppearanceSide:'appearance',cameraStickerSide:'stickers',cameraSignatureSide:'signatures',cameraTextSide:'text',cameraFrameSide:'frames',cameraMusicSide:'music'};
      if(kinds[button.id])openPanel(kinds[button.id],button);
    });
    $s('cameraPanelClose')?.addEventListener('click',closePanel);
    document.addEventListener('click',e=>{if(e.target.closest('#cameraSettingsBtn'))openPanel('settings',e.target.closest('#cameraSettingsBtn'));});
    let cameraGridActive=false;
    function setCameraGrid(active){
      cameraGridActive=!!active;
      const overlay=$s('cameraGridOverlay'),top=$s('cameraGridBtn'),side=$s('cameraGridSide');
      overlay?.classList.toggle('on',cameraGridActive);
      overlay?.setAttribute('aria-hidden',cameraGridActive?'false':'true');
      [top,side].forEach(button=>{
        button?.classList.toggle('active',cameraGridActive);
        button?.setAttribute('aria-pressed',cameraGridActive?'true':'false');
      });
    }
    function toggleCameraGrid(){setCameraGrid(!cameraGridActive);}
    $s('cameraGridBtn')?.addEventListener('click',toggleCameraGrid);
    const triggerCamera=(id)=>$s(id)?.click();
    $s('cameraTimerSide')?.addEventListener('click',e=>openPanel('timer',e.currentTarget));
    $s('cameraRatioSide')?.addEventListener('click',e=>openPanel('ratio',e.currentTarget));
    $s('cameraGridSide')?.addEventListener('click',toggleCameraGrid);
    setCameraGrid(false);
    $s('cameraLevelSide')?.addEventListener('click',toggleCameraLevel);
    $s('cameraBeautySide')?.addEventListener('click',e=>openPanel('beauty',e.currentTarget));
    $s('cameraRetouchSide')?.addEventListener('click',e=>openPanel('retouch',e.currentTarget));

    $s('cameraFlashBtn')?.addEventListener('click',async e=>{
      const button=e.currentTarget,track=myeventCameraStream?.getVideoTracks?.()[0];
      let caps;try{caps=track?.getCapabilities?.();}catch(error){}
      if(!track||track.readyState!=='live'||!caps?.torch){
        // iOS/Safari often exposes no torch control, especially on the front camera.
        // Keep the flash useful by falling back to a white-screen selfie flash.
        if(myeventFacingMode==='user'){
          const enable=!button.classList.contains('active');
          button.classList.toggle('active',enable);button.setAttribute('aria-pressed',String(enable));
          cameraModal.classList.toggle('cameraScreenFlashArmed',enable);
          button.setAttribute('aria-label',enable?'Désactiver le flash écran':'Activer le flash écran');
        }else{
          button.classList.remove('active');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Flash matériel indisponible');
        }
        return;
      }
      const enable=!button.classList.contains('active');
      // Arm the rear flash here; fire the torch only during capture.
      button.classList.toggle('active',enable);button.setAttribute('aria-pressed',String(enable));
      button.dataset.hardwareFlashArmed=enable?'1':'0';
      button.setAttribute('aria-label',enable?'Désactiver le flash':'Activer le flash');
    });
    $s('cameraRetouchBtn')?.addEventListener('click',()=>openPanel('retouch',$s('cameraRetouchSide')||$s('cameraRetouchBtn')));
    $s('cameraTimerBtn')?.addEventListener('click',()=>openPanel('timer',$s('cameraTimerSide')));
    $s('cameraQualityBtn')?.addEventListener('click',async e=>{
      const button=e.currentTarget,track=myeventCameraStream?.getVideoTracks?.()[0];
      if(!track||track.readyState!=='live')return;
      let caps,settings;try{caps=track.getCapabilities?.();settings=track.getSettings?.();}catch(error){}
      const maxW=Number(caps?.width?.max)||Number(settings?.width)||0,maxH=Number(caps?.height?.max)||Number(settings?.height)||0;
      const options=[['Auto',null],['HD',1280],['FHD',1920]].filter(([label,width])=>!width||maxW>=width);
      if(maxW>=3840)options.push(['4K',3840]);
      const current=button.dataset.q||'Auto',index=options.findIndex(([label])=>label===current),[next,width]=options[(index+1+options.length)%options.length];
      if(width){
        try{await track.applyConstraints({width:{ideal:width},height:{ideal:Math.round(width*9/16)}});}catch(error){return;}
      }else{
        try{await track.applyConstraints({width:{ideal:1280},height:{ideal:1280}});}catch(error){}
      }
      const actual=track.getSettings?.()||{},label=next==='Auto'?'Auto':next;
      button.dataset.q=next;button.innerHTML=label+' <b>Qualité</b><small>'+(actual.width&&actual.height?actual.width+'×'+actual.height:label)+'</small>';
      if($s('cameraQualityLabel'))$s('cameraQualityLabel').textContent=actual.width&&actual.height?actual.width+'×'+actual.height:label;
    });
    return {openPanel,closePanel,get factor(){return factor;},get hardware(){return hardware;},
      reset(){factor=1;track=null;hardware=false;zoomRequest++;startDistance=0;if(video)video.style.transform='none';if(indicator)indicator.classList.remove('visible');closePanel();},
      setTrack(newTrack){
        track=newTrack;let caps;
        try{caps=track?.getCapabilities?.();}catch(e){}
        hardware=!!(caps?.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max)&&typeof track.applyConstraints==='function');
        if(hardware){
          const current=Number(track.getSettings?.().zoom);
          factor=Number.isFinite(current)?current:Math.max(caps.zoom.min,1);
        }else factor=1;
        if(video)video.style.transform='none';
        display();
      }};
  })();
  // Camera modes: each button now has a distinct behavior instead of being decorative.
  let cameraMode='photo',mediaRecorder=null,recordingTimer=null;
  let cameraVideoFile=null,cameraVideoUrl='';
  function setCameraMode(mode){
    if(mediaRecorder?.state==='recording'||cameraModal?.dataset.cameraState==='processing')return;
    if(mode==='plus'){cameraZoom.openPanel('plus',$s('cameraPlusBtn'));return;}
    if(cameraVideoFile||cameraSourceCanvas)resetCameraPreview();
    cancelCountdown();cameraZoom.closePanel();
    const previousMode=cameraMode;let restart=mode==='video'||previousMode==='video'||!myeventCameraStream;
    cameraMode=mode;$s('myeventCameraModal').dataset.captureMode=mode;
    const modal=$s('myeventCameraModal'),sheet=modal?.querySelector('.cameraProSheet');
    sheet?.querySelectorAll('.cameraModeBtn').forEach(b=>b.classList.toggle('active',b.dataset.cameraMode===mode));
    const title=$s('cameraModeTitle');if(title)title.textContent=({video:'VIDÉO',photo:'PHOTO',selfie:'SELFIE',portrait:'PORTRAIT',plus:'PLUS'})[mode]||'PHOTO';
    sheet?.classList.toggle('cameraPortraitMode',mode==='portrait');
    if(mode==='selfie'){
      if(myeventFacingMode!=='user'){myeventFacingMode='user';restart=true;}
    }else if(mode==='photo'||mode==='portrait'){
      if(mode==='photo')sheet?.classList.remove('cameraPortraitMode');
      if(myeventFacingMode!=='environment'){myeventFacingMode='environment';restart=true;}
    }
    $s('cameraShutterBtn')?.setAttribute('aria-label',mode==='video'?'Enregistrer une vidéo':'Prendre une photo');
    const note=$s('cameraMediaStatus');if(note)note.textContent=mode==='portrait'?'Portrait · détection du visage, sans flou de profondeur':mode==='video'?'Vidéo originale · 60 s maximum · effets photo non appliqués':'';
    if(restart)startMyEventCamera();else $s('myeventCameraModal').cameraSetFilter?.($s('myeventCameraModal').cameraGetFilter?.());
  }
  $s('cameraPhotoBtn')?.addEventListener('click',()=>setCameraMode('photo'));
  $s('cameraSelfieBtn')?.addEventListener('click',()=>setCameraMode('selfie'));
  $s('cameraPortraitBtn')?.addEventListener('click',()=>setCameraMode('portrait'));
  $s('cameraPlusBtn')?.addEventListener('click',()=>setCameraMode('plus'));
  $s('cameraVideoBtn')?.addEventListener('click',()=>setCameraMode('video'));
  if(typeof MediaRecorder==='undefined'){$s('cameraVideoBtn').disabled=true;$s('cameraVideoBtn').title='Enregistrement vidéo indisponible sur ce navigateur. Tu peux importer une vidéo.';}

  // V54.48 — caméra centrale : selfie/photo d'abord, création d'événement toujours accessible
  let myeventCameraStream=null, myeventFacingMode='environment', myeventCapturedDataUrl='';
  const cameraModal=$s('myeventCameraModal'), cameraVideo=$s('myeventCameraVideo'), cameraPlaceholder=$s('cameraPlaceholder'), cameraImg=$s('myeventCapturedImage'), cameraFile=$s('cameraFileInput');
  let cameraRevision=0,cameraSourceCanvas=null,cameraAISourceCanvas=null;
  function resetCameraPreview(){
    cancelCountdown();
    cameraRevision++;
    clearTimeout(recordingTimer);
    cameraVideoFile=null;if(cameraVideoUrl){URL.revokeObjectURL(cameraVideoUrl);cameraVideoUrl='';}
    const clip=$s('myeventCapturedVideo');if(clip){clip.pause();clip.removeAttribute('src');clip.hidden=true;clip.load();}
    cameraModal.dataset.mediaKind='photo';
    $s('cameraStoryBtn').disabled=false;$s('myeventCapturedVideo').onerror=null;$s('myeventCapturedVideo').onloadedmetadata=null;
    ['cameraPublishBtn','cameraAttachEventBtn'].forEach(id=>{const b=$s(id);if(b)b.hidden=false;});
    myeventCapturedDataUrl='';
    cameraSourceCanvas=null;cameraAISourceCanvas=null;
    cameraModal.dataset.cameraState='viewfinder';
    cameraModal.dispatchEvent(new Event('camera-source-reset'));
    cameraImg.onload=null;cameraImg.onerror=null;
    cameraImg.removeAttribute('src');cameraImg.style.display='none';
    cameraVideo.style.display='block';
    $s('cameraCapturedActions')?.classList.remove('open');
    return cameraRevision;
  }
  function showCameraPreview(data,revision,previewData=data){
    if(revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
    cameraImg.onload=()=>{
      if(revision!==cameraRevision||!cameraModal.classList.contains('open')||!cameraImg.naturalWidth)return;
      myeventCapturedDataUrl=data;
      cameraImg.style.filter='none';
      cameraImg.style.display='block';cameraVideo.style.display='none';cameraPlaceholder.style.display='none';
      cameraModal.dataset.cameraState='preview';
      cameraModal.dispatchEvent(new Event('camera-preview-ready'));
      $s('cameraCapturedActions')?.classList.add('open');
    };
    cameraImg.onerror=()=>{if(revision===cameraRevision)resetCameraPreview();};
    cameraImg.src=previewData;
  }
  function stopMyEventCamera(){
    if(mediaRecorder){mediaRecorder.onstop=null;mediaRecorder.ondataavailable=null;mediaRecorder.onerror=null;if(mediaRecorder.state==='recording')mediaRecorder.stop();mediaRecorder=null;}
    clearTimeout(recordingTimer);$s('cameraShutterBtn')?.classList.remove('recording');
    cameraZoom.reset();if(levelActive){levelActive=false;window.removeEventListener('deviceorientation',onCameraOrientation);$s('cameraLevelIndicator').hidden=true;$s('cameraLevelSide').classList.remove('active');}
    try{myeventCameraStream?.getTracks().forEach(t=>t.stop())}catch(e){} myeventCameraStream=null;cameraVideo.srcObject=null;
  }
  async function startMyEventCamera(){
    const revision=resetCameraPreview();stopMyEventCamera();cameraPlaceholder.style.display='grid';
    if(!navigator.mediaDevices?.getUserMedia){cameraPlaceholder.innerHTML='<strong>Caméra non disponible ici</strong><span>Utilise « Galerie » pour prendre un selfie.</span>';return;}
    try{
      const constraints={video:{facingMode:myeventFacingMode,width:{ideal:1280},height:{ideal:1280}},audio:cameraMode==='video'};
      let stream;
      try{stream=await navigator.mediaDevices.getUserMedia(constraints);}
      catch(error){
        if(!constraints.audio||!['NotAllowedError','NotFoundError','NotReadableError'].includes(error.name))throw error;
        if(revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
        stream=await navigator.mediaDevices.getUserMedia({...constraints,audio:false});
      }
      if(revision!==cameraRevision||!cameraModal.classList.contains('open')){stream.getTracks().forEach(t=>t.stop());return;}
      myeventCameraStream=stream;cameraVideo.srcObject=stream;
      const videoTrack=stream.getVideoTracks()[0];cameraZoom.setTrack(videoTrack);cameraPlaceholder.style.display='none';cameraVideo.play().catch(()=>{});
      const quality=$s('cameraQualityBtn'),qualityLabel=$s('cameraQualityLabel'),settings=videoTrack.getSettings?.()||{};
      if(quality){quality.dataset.q='Auto';quality.innerHTML='Auto <b>Qualité</b><small>'+(settings.width&&settings.height?settings.width+'×'+settings.height:'Auto')+'</small>';}
      if(qualityLabel)qualityLabel.textContent=settings.width&&settings.height?settings.width+'×'+settings.height:'Auto';
      const flash=$s('cameraFlashBtn');let caps;try{caps=videoTrack?.getCapabilities?.();}catch(error){}
      if(flash){
        const available=!!caps?.torch;
        const screenFlash=myeventFacingMode==='user'&&!available;
        flash.disabled=!available&&!screenFlash;flash.classList.remove('active');flash.setAttribute('aria-pressed','false');flash.dataset.hardwareFlashArmed='0';cameraModal.classList.remove('cameraScreenFlashArmed');
        flash.setAttribute('aria-label',available?'Activer le flash':(screenFlash?'Activer le flash écran':'Flash matériel indisponible'));
      }
      cameraVideo.style.filter=cameraMode==='video'?'none':cameraVideo.style.filter;
      cameraModal.cameraSetFilter?.(cameraModal.cameraGetFilter?.());
      if(cameraMode==='video')$s('cameraMediaStatus').textContent=stream.getAudioTracks().length?'Vidéo originale · 60 s maximum':'Vidéo sans son · micro indisponible · 60 s maximum';
      cameraModal.dispatchEvent(new Event('camera-stream-ready'));
    }catch(e){if(revision===cameraRevision){cameraPlaceholder.style.display='grid';cameraPlaceholder.innerHTML='<strong>Autorisation caméra nécessaire</strong><span>Autorise l’appareil photo ou utilise « Galerie ».</span>';}}
  }
  let cameraReturnFocus=null;
  function openMyEventCamera(){cameraReturnFocus=document.activeElement;cameraModal.classList.add('open');document.body.classList.add('camera-is-open');cameraModal.setAttribute('aria-hidden','false');$s('cameraCloseBtn').focus();startMyEventCamera();}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&cameraModal.classList.contains('open')&&!document.querySelector('.myeventCameraEventDialog')){if(!$s('cameraCreativePanel').hidden)cameraZoom.closePanel();else closeMyEventCamera();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&cameraModal.classList.contains('open'))closeMyEventCamera();});
  function closeMyEventCamera(){resetCameraPreview();stopMyEventCamera();cameraModal.classList.remove('open');document.body.classList.remove('camera-is-open');cameraModal.setAttribute('aria-hidden','true');cameraModal.dispatchEvent(new Event('camera-closed'));cameraReturnFocus?.focus?.();}
  cameraModal?.addEventListener('camera-retake',()=>{if(cameraModal.classList.contains('open'))startMyEventCamera();});
  $s('cameraCloseBtn')?.addEventListener('click',closeMyEventCamera);
  cameraModal?.addEventListener('click',e=>{if(e.target===cameraModal)closeMyEventCamera()});
  async function renderCameraPhoto(revision){
    if(!cameraSourceCanvas||revision!==cameraRevision)return;
    const source=cameraAISourceCanvas||cameraSourceCanvas;
    // Always render from the unfiltered source, including after changing a filter.
    myeventCapturedDataUrl='';
    cameraModal.dataset.cameraState='processing';
    cameraModal.dispatchEvent(new Event('camera-photo-pending'));
    $s('cameraCapturedActions')?.classList.remove('open');
    try{
      let output=cameraModal.cameraRenderPhoto?cameraModal.cameraRenderPhoto(source):source;
      if(!cameraAISourceCanvas&&cameraModal.cameraComposeAppearance)output=await cameraModal.cameraComposeAppearance(source,output);
      if(revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
      const previewData=output.toDataURL('image/jpeg',.9);
      if(cameraModal.cameraRenderDecorations)output=cameraModal.cameraRenderDecorations(output);
      if(cameraModal.cameraCropExport)output=cameraModal.cameraCropExport(output);
      showCameraPreview(output.toDataURL('image/jpeg',.9),revision,previewData);
    }catch(error){
      if(revision!==cameraRevision||error.name==='AbortError')return;
      resetCameraPreview();cameraPlaceholder.textContent='Impossible de préparer la photo. Réessaie ou utilise Galerie.';cameraPlaceholder.style.display='grid';
    }
  }
  let cameraAILensesLoading;
  cameraModal.cameraRenderAI=function(host){
    if(!cameraAILensesLoading)cameraAILensesLoading=import('./camera-ai-lenses.mjs?v=camera-feed-ai-1').then(m=>m.createAILenses(cameraModal)).catch(error=>{cameraAILensesLoading=null;throw error;});
    cameraAILensesLoading.then(ui=>{if(cameraModal.classList.contains('open')&&$s('cameraCreativePanel')?.dataset.kind==='ai')ui.render(host);}).catch(()=>{host.textContent='Impossible de charger les filtres IA. Réessaie.';});
  };
  cameraModal.cameraGetAIPhoto=function(){
    if(!cameraSourceCanvas||cameraModal.dataset.cameraState!=='preview')return null;
    const source=cameraSourceCanvas,scale=Math.min(1,1280/Math.max(source.width,source.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const imageData=canvas.toDataURL('image/jpeg',.85);canvas.width=canvas.height=0;
    return {imageData,revision:cameraRevision};
  };
  cameraModal.cameraHasAIPhoto=()=>!!cameraAISourceCanvas;
  cameraModal.cameraApplyAIPhoto=async function(data,revision,signal){
    const image=new Image();image.src=data;await image.decode();
    if(signal?.aborted||revision!==cameraRevision||!cameraModal.classList.contains('open'))return false;
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    canvas.getContext('2d').drawImage(image,0,0);cameraAISourceCanvas=canvas;
    await renderCameraPhoto(++cameraRevision);return true;
  };
  cameraModal.cameraRestoreAIPhoto=function(){
    if(!cameraSourceCanvas||!cameraAISourceCanvas)return;
    cameraAISourceCanvas=null;renderCameraPhoto(++cameraRevision);
  };
  cameraModal.cameraGetPhotoSource=()=>cameraAISourceCanvas||cameraSourceCanvas;
  cameraModal.cameraHasPhoto=()=>!!cameraSourceCanvas&&!cameraVideoFile;
  cameraModal.cameraGetMediaFile=async()=>cameraVideoFile||(myeventCapturedDataUrl?new File([await(await fetch(myeventCapturedDataUrl)).blob()],'MyEvent-photo.jpg',{type:'image/jpeg'}):null);
  cameraModal.addEventListener('camera-decoration-change',()=>{if(cameraSourceCanvas)renderCameraPhoto(++cameraRevision);});
  cameraModal.addEventListener('camera-filter-change',()=>{if(cameraSourceCanvas)renderCameraPhoto(++cameraRevision);});
  cameraModal.addEventListener('camera-appearance-change',()=>{if(cameraSourceCanvas)renderCameraPhoto(++cameraRevision);});
  cameraModal.cameraDrawFrame=function(c,maxEdge=Infinity){
    const z=cameraZoom.factor||1,hardware=cameraZoom.hardware;
    const [rw,rh]=cameraRatio.split(':').map(Number),ratio=rw/rh;
    const sourceW=cameraVideo.videoWidth,sourceH=cameraVideo.videoHeight,sourceRatio=sourceW/sourceH;
    let cropW,cropH;
    if(sourceRatio>ratio){cropH=sourceH;cropW=cropH*ratio;}else{cropW=sourceW;cropH=cropW/ratio;}
    // The exported image uses the same centered aspect-ratio crop as the live view.
    const cropZoom=hardware?1:z,w=cropW/cropZoom,h=cropH/cropZoom;
    const scale=Math.min(1,maxEdge/Math.max(cropW,cropH));
    c.width=Math.max(1,Math.round(cropW*scale));c.height=Math.max(1,Math.round(cropH*scale));
    c.getContext('2d').drawImage(cameraVideo,(sourceW-w)/2,(sourceH-h)/2,w,h,0,0,c.width,c.height);
  };
  async function captureMyEventPhoto(){
    if(cameraModal.dataset.cameraState==='processing')return;
    if(cameraModal.dataset.cameraState==='preview'){startMyEventCamera();return;}
    if(!myeventCameraStream||cameraVideo.readyState<2||!cameraVideo.videoWidth){cameraFile?.click();return;}
    if(cameraMode==='portrait'){
      cameraPlaceholder.textContent='Mode Portrait : vérification du visage…';cameraPlaceholder.style.display='grid';
      const probe=document.createElement('canvas');cameraModal.cameraDrawFrame(probe,640);
      try{
        const {FaceEngine}=await import('./camera-face-engine.mjs'),engine=new FaceEngine();
        let face=null;try{face=await engine.detect(probe,'IMAGE');}finally{engine.close();probe.width=probe.height=0;}
        if(!face){cameraPlaceholder.textContent='Aucun visage détecté. Rapproche-toi ou utilise PHOTO.';cameraPlaceholder.style.display='grid';return;}
      }catch(error){
        cameraPlaceholder.textContent='Portrait indisponible sur cet appareil. Utilise PHOTO.';cameraPlaceholder.style.display='grid';return;
      }
    }
    const revision=resetCameraPreview(),c=document.createElement('canvas');
    const flashButton=$s('cameraFlashBtn'),track=myeventCameraStream?.getVideoTracks?.()[0];
    const screenFlash=cameraModal.classList.contains('cameraScreenFlashArmed')&&myeventFacingMode==='user';
    const hardwareFlash=myeventFacingMode==='environment'&&flashButton?.dataset.hardwareFlashArmed==='1'&&track?.readyState==='live';
    if(screenFlash){cameraModal.classList.add('cameraScreenFlashFire');await new Promise(resolve=>setTimeout(resolve,140));}
    if(hardwareFlash){try{await track.applyConstraints({advanced:[{torch:true}]});await new Promise(resolve=>setTimeout(resolve,180));}catch(error){}}
    cameraModal.cameraDrawFrame(c);
    if(hardwareFlash){try{await track.applyConstraints({advanced:[{torch:false}]});}catch(error){}}
    if(screenFlash){setTimeout(()=>cameraModal.classList.remove('cameraScreenFlashFire'),90);}
    cameraSourceCanvas=c;renderCameraPhoto(revision);
  }
  $s('cameraShutterBtn')?.addEventListener('click',()=>{
    if(cameraModal.dataset.cameraState==='preview'&&cameraVideoFile){startMyEventCamera();return;}
    if(cameraMode==='video'){
      cancelCountdown();
      if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();return;}
      if(!myeventCameraStream||typeof MediaRecorder==='undefined'){
        cameraPlaceholder.textContent='Enregistrement vidéo indisponible sur ce navigateur.';cameraPlaceholder.style.display='grid';return;
      }
      const revision=cameraRevision;
      try{
        const preferred=['video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported?.(type));
        const recorder=preferred?new MediaRecorder(myeventCameraStream,{mimeType:preferred}):new MediaRecorder(myeventCameraStream);mediaRecorder=recorder;
        let chunks=[],bytes=0,failed=false;
        recorder.ondataavailable=e=>{if(e.data?.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>48*1024*1024&&recorder.state==='recording')recorder.stop();}};
        recorder.onerror=()=>{failed=true;clearTimeout(recordingTimer);if(recorder.state==='recording')recorder.stop();cameraPlaceholder.textContent='Erreur pendant l’enregistrement vidéo. Réessaie.';cameraPlaceholder.style.display='grid';$s('cameraShutterBtn')?.classList.remove('recording');};
        recorder.onstop=()=>{
          clearTimeout(recordingTimer);$s('cameraShutterBtn')?.classList.remove('recording');
          if(failed||revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
          const type=(recorder.mimeType||chunks[0]?.type||'video/mp4').split(';')[0],blob=new Blob(chunks,{type});chunks=[];
          if(!blob.size)return;
          showCameraVideo(new File([blob],'MyEvent-video.'+(type==='video/mp4'?'mp4':'webm'),{type}));
        };
        recorder.start(1000);$s('cameraShutterBtn')?.classList.add('recording');
        $s('cameraShutterBtn')?.setAttribute('aria-label','Arrêter l’enregistrement');
        recordingTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},60000);
        $s('cameraMediaStatus').textContent='Enregistrement '+(myeventCameraStream.getAudioTracks().length?'':'sans son ')+'en cours · appuie pour arrêter (60 s max).';
      }catch(e){cameraPlaceholder.textContent='Impossible de démarrer l’enregistrement vidéo.';cameraPlaceholder.style.display='grid';}
      return;
    }
    if(cameraModal.dataset.cameraState==='processing')return;
    if(cameraModal.dataset.cameraState==='preview'||!timerSeconds||!myeventCameraStream||cameraVideo.readyState<2){captureMyEventPhoto();return;}
    if(!$s('cameraCountdown').hidden){cancelCountdown();return;}
    const token=++countdownToken,revision=cameraRevision,el=$s('cameraCountdown');
    el.hidden=false;el.textContent=String(timerSeconds);
    let remaining=timerSeconds;
    const tick=()=>{if(token!==countdownToken||revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
      remaining--;if(remaining>0){el.textContent=String(remaining);setTimeout(tick,1000);}else{el.hidden=true;el.textContent='';captureMyEventPhoto();}};
    setTimeout(tick,1000);
  });
  function showCameraVideo(file){
    if(!['video/mp4','video/quicktime','video/webm'].includes(file.type.split(';')[0])||file.size>50*1024*1024){$s('cameraMediaStatus').textContent='Vidéo non prise en charge ou supérieure à 50 Mo.';return;}
    resetCameraPreview();stopMyEventCamera();cameraZoom.closePanel();
    cameraVideoFile=file;cameraVideoUrl=URL.createObjectURL(file);
    const clip=$s('myeventCapturedVideo');clip.src=cameraVideoUrl;clip.hidden=false;
    const revision=cameraRevision;
    clip.onerror=()=>{if(revision!==cameraRevision)return;$s('cameraMediaStatus').textContent='Cette vidéo ne peut pas être lue sur cet appareil. Choisis un autre fichier.';$s('cameraStoryBtn').disabled=true;};
    clip.onloadedmetadata=()=>{if(revision===cameraRevision)$s('cameraStoryBtn').disabled=false;};
    cameraImg.style.display='none';cameraVideo.style.display='none';cameraPlaceholder.style.display='none';
    cameraModal.dataset.cameraState='preview';cameraModal.dataset.mediaKind='video';
    $s('cameraCapturedActions')?.classList.add('open');
    $s('cameraPublishBtn').hidden=true;$s('cameraAttachEventBtn').hidden=false;
    $s('cameraMediaStatus').textContent='Aperçu vidéo originale · Story, événement ou enregistrement · sans effets photo.';
    cameraModal.dispatchEvent(new Event('camera-preview-ready'));
  }
  $s('cameraDownloadBtn')?.addEventListener('click',()=>{
    const url=cameraVideoUrl||myeventCapturedDataUrl;if(!url)return;
    const link=document.createElement('a');link.href=url;link.download=cameraVideoFile?.name||'MyEvent-photo.jpg';link.click();
  });
  $s('cameraStoryBtn')?.addEventListener('click',async()=>{
    const button=$s('cameraStoryBtn'),revision=cameraRevision;button.disabled=true;
    try{const file=await cameraModal.cameraGetMediaFile();if(!file||revision!==cameraRevision||!cameraModal.classList.contains('open'))return;if(typeof window.myeventPrepareCameraStory!=='function')throw Error('Stories indisponibles.');await window.myeventPrepareCameraStory(file,window.MyEventCameraMusicSelection);closeMyEventCamera();}
    catch(error){$s('cameraMediaStatus').textContent='Story impossible : '+error.message;}finally{button.disabled=false;}
  });
  $s('cameraGalleryBtn')?.addEventListener('click',()=>{
    if(cameraModal.dataset.cameraState==='processing'||mediaRecorder?.state==='recording')return;
    cameraZoom.openPanel('gallery',$s('cameraGalleryBtn'));
  });
  cameraFile?.addEventListener('change',()=>{
    const file=cameraFile.files?.[0];
    cameraFile.value='';
    selectCameraMediaFile(file);
  });
  function selectCameraMediaFile(file){
    if(!file)return;
    cameraZoom.closePanel();
    if(file.type.startsWith('video/')){showCameraVideo(file);return;}
    if(!file.type.startsWith('image/')){
      cameraPlaceholder.textContent='Choisis une photo ou une vidéo dans ta galerie.';
      cameraPlaceholder.style.display='grid';
      return;
    }
    const revision=resetCameraPreview(),objectUrl=URL.createObjectURL(file),source=new Image();
    cameraPlaceholder.textContent='Préparation de la photo…';
    cameraPlaceholder.style.display='grid';
    source.onload=()=>{
      URL.revokeObjectURL(objectUrl);
      if(revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
      try{
        const maxEdge=4096,scale=Math.min(1,maxEdge/Math.max(source.naturalWidth,source.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('Canvas indisponible');
        ctx.drawImage(source,0,0,canvas.width,canvas.height);
        cameraSourceCanvas=canvas;
        cameraPlaceholder.style.display='none';
        renderCameraPhoto(revision);
      }catch(error){
        resetCameraPreview();
        cameraPlaceholder.textContent='Impossible d’importer cette photo.';
        cameraPlaceholder.style.display='grid';
      }
    };
    source.onerror=()=>{
      URL.revokeObjectURL(objectUrl);
      if(revision!==cameraRevision)return;
      resetCameraPreview();
      cameraPlaceholder.textContent='Format de photo non pris en charge.';
      cameraPlaceholder.style.display='grid';
    };
    source.src=objectUrl;
  }
  cameraModal.cameraSelectMediaFile=selectCameraMediaFile;
  $s('cameraFlipBtn')?.addEventListener('click',()=>{
    if(mediaRecorder?.state==='recording'||cameraModal.dataset.cameraState==='processing')return;
    myeventFacingMode=myeventFacingMode==='user'?'environment':'user';
    if(cameraMode==='photo'||cameraMode==='selfie'){
      cameraMode=myeventFacingMode==='user'?'selfie':'photo';cameraModal.dataset.captureMode=cameraMode;
      const sheet=cameraModal?.querySelector('.cameraProSheet');
      sheet?.querySelectorAll('.cameraModeBtn').forEach(b=>b.classList.toggle('active',b.dataset.cameraMode===cameraMode));
      const title=$s('cameraModeTitle');if(title)title.textContent=cameraMode==='selfie'?'SELFIE':'PHOTO';
    }
    startMyEventCamera();
  });
  $s('cameraIaBtn')?.addEventListener('click',()=>{
    const source=$s('cameraAiSide')||$s('cameraIaBtn');
    const panel=$s('cameraCreativePanel');
    if(cameraModal.dataset.cameraState!=='preview'){
      cameraZoom.openPanel('ai',source);
      const note=panel?.querySelector('#cameraPanelContent p');
      if(note)note.textContent='Prends une photo ou importe-en une depuis Galerie, puis choisis un filtre IA.';
      return;
    }
    cameraZoom.openPanel('ai',source);
  });
  function openCameraEventDestination(){
    if(document.querySelector('.myeventCameraEventDialog'))return;
    if(!myeventCapturedDataUrl&&!cameraVideoFile){alert('Prends ou importe une photo ou une vidéo avant de l’ajouter à un événement.');return;}
    const photo=cameraVideoFile||myeventCapturedDataUrl,isVideo=!!cameraVideoFile,dialog=document.createElement('dialog');dialog.className='myeventCameraEventDialog';
    const title=document.createElement('h3');title.textContent='Ajouter '+(isVideo?'la vidéo':'la photo')+' à un événement';
    const select=document.createElement('select');select.setAttribute('aria-label','Événement');select.append(new Option('Choisir un événement',''));
    for(const card of document.querySelectorAll('#eventList .eventCard[data-event-id]'))select.append(new Option(card.querySelector('.eventCardTopInfo b')?.textContent||'Événement',card.dataset.eventId));
    const status=document.createElement('p');status.setAttribute('role','status');
    const add=document.createElement('button');add.type='button';add.textContent='Ajouter à cet événement';add.disabled=true;
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Annuler';
    select.onchange=()=>{add.disabled=!select.value;};cancel.onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.addEventListener('cancel',e=>{if(select.disabled)e.preventDefault();});
    add.onclick=async()=>{
      const id=select.value;if(!id)return;
      add.disabled=true;select.disabled=true;cancel.disabled=true;status.textContent='Enregistrement '+(isVideo?'de la vidéo':'de la photo')+'…';
      try{
        if(typeof window.myeventAttachCameraPhoto!=='function')throw Error('Enregistrement des souvenirs indisponible.');
        await window.myeventAttachCameraPhoto(id,photo);
        closeMyEventCamera();dialog.close();
        globalThis.dispatchEvent(new CustomEvent('myevent-camera-photo-attached',{detail:{eventId:id}}));
        alert((isVideo?'Vidéo ajoutée':'Photo ajoutée')+' aux souvenirs de « '+select.selectedOptions[0].textContent+' » ✓');
        if(typeof selectEvent==='function')await selectEvent(id).catch(()=>{});
      }catch(error){status.textContent='Impossible d’ajouter la photo : '+(error?.message||String(error));add.disabled=false;select.disabled=false;cancel.disabled=false;}
    };
    dialog.append(title,select,status,add,cancel);document.body.append(dialog);dialog.showModal();
    if(select.options.length===1)status.textContent='Aucun événement disponible. Crée ou rejoins un événement puis réessaie.';
  }
  $s('cameraEventBtn')?.addEventListener('click',openCameraEventDestination);
  window.addEventListener('myevent-release-camera-microphone',()=>{if(myeventCameraStream?.getAudioTracks().length)closeMyEventCamera();});
  function renderCameraFeedPost(item,prepend=true){
    if(!item?.image)return;
    if($s('socialFeedEmpty'))$s('socialFeedEmpty').hidden=true;
    const post=document.createElement('article');post.className='socialPost';post.dataset.cameraPostId=item.id||'';
    post.innerHTML='<div class="socialPostHead"><div class="socialPostAvatar">📸</div><div class="socialPostMeta"><b>Moi</b><span></span></div></div><div class="socialPostText"></div><img alt="Photo MyEvent" style="display:block;width:100%;height:auto;max-height:none;object-fit:contain;border-top:1px solid #2a3035;border-bottom:1px solid #2a3035"><div class="socialActions"><button type="button" class="socialLikeBtn">♡ J’aime <span>0</span></button><button type="button" class="socialCommentBtn">💬 Commenter</button><button type="button" class="socialShareBtn">↗️ Partager</button></div><div class="socialCommentBox"><input placeholder="Écrire un commentaire…"><button type="button">Envoyer</button></div>';
    post.querySelector('img').src=item.image;post.querySelector('.socialPostText').textContent=item.content||'📸 Nouveau moment partagé sur MyEvent.';post.querySelector('.socialPostMeta span').textContent=(item.created_at?new Date(item.created_at).toLocaleString('fr-FR'):'À l’instant')+' · 📍 MyEvent';
    prepend?$s('socialFeed')?.prepend(post):$s('socialFeed')?.append(post);
    window.myeventFeedInteractions?.attach(post);
  }
  async function loadCameraFeedPosts(){
    if(typeof window.myeventLoadCameraPosts!=='function')return;
    try{const rows=await window.myeventLoadCameraPosts(30);rows.slice().reverse().forEach(item=>renderCameraFeedPost(item,true));}catch(error){console.warn('Fil caméra Supabase indisponible:',error?.message||error);}
  }
  setTimeout(loadCameraFeedPosts,500);
  $s('cameraPublishBtn')?.addEventListener('click',async()=>{
    if(!myeventCapturedDataUrl)return;
    const button=$s('cameraPublishBtn');button.disabled=true;
    try{
      if(typeof window.myeventPublishCameraPost!=='function')throw new Error('Publication Supabase indisponible.');
      const saved=await window.myeventPublishCameraPost(myeventCapturedDataUrl);
      const signedRows=await window.myeventLoadCameraPosts?.(1);
      renderCameraFeedPost(signedRows?.[0]||{...saved,image:myeventCapturedDataUrl},true);
      closeMyEventCamera();
    }catch(error){
      cameraPlaceholder.textContent='Publication impossible : '+(error?.message||String(error));cameraPlaceholder.style.display='grid';
    }finally{button.disabled=false;}
  });
  $s('cameraAttachEventBtn')?.addEventListener('click',openCameraEventDestination);
  $s('socialBackToFeedBtn')?.addEventListener('click',()=>tab('feed'));
  $s('socialGlobalFriendsBtn')?.addEventListener('click',()=>tab('friends'));
  $s('socialGlobalEventsBtn')?.addEventListener('click',()=>{const el=$s('eventsCard');if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'})}});
  // Profil > Apparence est géré par theme-runtime.js pour tous les écrans.
  tab('feed');
  setInterval(()=>{try{const n=$s('who')?.textContent?.trim();if(n&&n!=='Utilisateur')$s('socialHeaderName').textContent='Bonjour '+n;const a=$s('profileAvatar');const h=$s('socialHeaderAvatar');if(a&&h&&a.querySelector('img'))h.innerHTML=a.innerHTML;else if(a&&h&&a.textContent.trim()&&a.textContent.trim()!=='?')h.textContent=a.textContent.trim()}catch(e){}},1500);
  try{const av=$s('profileAvatar')?.textContent?.trim();if(av&&av!=='?'){ $s('socialMyAvatar').textContent=av; $s('socialHeaderAvatar').textContent=av;} const n=$s('who')?.textContent?.trim(); if(n&&n!=='Utilisateur') $s('socialHeaderName').textContent='Bonjour '+n;}catch(e){}
})();

/* ===== original inline script 24 ===== */
(function(){
  function normalizeSocialFilters(){
    const root=document.getElementById('socialHome'); if(!root) return;
    const filters=[...root.querySelectorAll('.socialFilter')]; if(!filters.length) return;
    let active=filters.find(x=>x.classList.contains('active'))||filters[0];
    filters.forEach(x=>x.classList.toggle('active',x===active));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',normalizeSocialFilters,{once:true});
  else normalizeSocialFilters();
  setTimeout(normalizeSocialFilters,300);
})();

/* ===== original inline script 25 ===== */
(function(){
  function forceSixVisible(){
    const root=document.getElementById('socialHome');
    if(!root) return;
    const stories=root.querySelector('.socialStories');
    if(stories){
      stories.style.gridTemplateColumns='repeat(6,minmax(0,1fr))';
      stories.style.overflow='visible';
    }
    const filters=[...root.querySelectorAll('.socialFilter')];
    if(filters.length){
      const active=filters.find(b=>b.classList.contains('active'))||filters[0];
      filters.forEach(b=>b.classList.toggle('active',b===active));
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',forceSixVisible,{once:true});
  else forceSixVisible();
  setTimeout(forceSixVisible,200);
})();

/* ===== original inline script 26 ===== */
(function(){
  const $=id=>document.getElementById(id);

  function bind(id,fn){
    const old=$(id); if(!old)return;
    const fresh=old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn(e,fresh);});
  }

  function showProfile(){
    const c=$('profileSettingsCard'); if(!c)return;
    c.classList.add('profileSettingsVisible','profileSettingsOpen');
    c.style.display='block';
    setTimeout(()=>c.scrollIntoView({behavior:'smooth',block:'start'}),20);
  }
  function hideProfile(){
    const c=$('profileSettingsCard'); if(!c)return;
    c.classList.remove('profileSettingsVisible','profileSettingsOpen');
    c.style.display='none';
  }

  function openOverlay(kind){
    if(window.myeventSocialInbox){window.myeventSocialInbox.open(kind);return;}
    const oid=kind==='messages'?'myeventGlobalMessagesOverlay':'myeventGlobalNotificationsOverlay';
    const sid=kind==='messages'?'socialMessagesView':'socialGlobalNotificationsView';
    const bid=kind==='messages'?'myeventGlobalMessagesBody':'myeventGlobalNotificationsBody';
    const o=$(oid), source=$(sid), body=$(bid);
    if(!o||!source||!body)return;
    body.innerHTML=source.innerHTML;
    o.classList.add('open');
    o.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeOverlay(id){
    window.myeventSocialInbox?.closed();
    const o=$(id); if(!o)return;
    o.classList.remove('open');
    o.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  function openEventModule(id){
    const x=$(id); if(!x)return;
    if(x.tagName==='DETAILS')x.open=true;
    x.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function init(){
    // PETITS BOUTONS EN HAUT À DROITE = social/global
    bind('socialHeaderMessagesBtnTop',()=>openOverlay('messages'));
    bind('socialHeaderNotificationsBtnTop',()=>openOverlay('notifications'));

    // BOUTONS DANS "MES ÉVÉNEMENTS" = messages/notifications DE L'ÉVÉNEMENT
    bind('socialHeaderMessagesBtn',()=>{
      if(typeof showEventTab==='function') showEventTab('discussion',true);
      const p=$('discussionPanel'); if(p){p.classList.add('active');p.open=true;p.scrollIntoView({behavior:'smooth',block:'start'});}
    });
    bind('socialHeaderNotificationsBtn',()=>{
      const p=$('notificationCenter'); if(p){p.open=true;p.scrollIntoView({behavior:'smooth',block:'start'});}
    });

    // PROFIL : ouvrir / réduire / enregistrer puis réduire
    bind('closeProfileBtn',hideProfile);
    bind('saveProfileBtn',()=>setTimeout(hideProfile,250));
    const nav=$('socialBottomNav');
    const p=nav?.querySelector('[data-bottom-tab="profile"]');
    if(p){
      const fresh=p.cloneNode(true); p.replaceWith(fresh);
      fresh.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        nav.querySelectorAll('[data-bottom-tab]').forEach(x=>x.classList.toggle('active',x===fresh));
        showProfile();
      });
    }
    bind('profileAvatar',showProfile);

    // FERMETURE DES PANNEAUX GLOBAUX
    bind('closeGlobalMessagesBtn',()=>closeOverlay('myeventGlobalMessagesOverlay'));
    bind('closeGlobalNotificationsBtn',()=>closeOverlay('myeventGlobalNotificationsOverlay'));
    ['myeventGlobalMessagesOverlay','myeventGlobalNotificationsOverlay'].forEach(id=>{
      const o=$(id); if(o)o.addEventListener('click',e=>{if(e.target===o)closeOverlay(id);});
    });

  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

/* ===== original inline script 27 ===== */
(function(){
  const $=id=>document.getElementById(id);
  const SHARE_KEY='myevent_social_location_share_v1';
  const LAST_POS_KEY='myevent_social_last_position_v1';

  const weatherIcon={
    0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',
    56:'🌧️',57:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',
    71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',
    85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'
  };

  function isShareEnabled(){return localStorage.getItem(SHARE_KEY)==='1'}
  function setShareEnabled(v){
    localStorage.setItem(SHARE_KEY,v?'1':'0');
    updateShareUI();
  }
  function updateShareUI(){
    const t=$('myeventNearbyShareToggle'), st=$('myeventNearbyStatus');
    const on=isShareEnabled();
    if(t)t.checked=on;
    if(st)st.textContent=on?'Activé — position autorisée sur cet appareil':'Désactivé';
  }

  function savePosition(pos){
    try{
      localStorage.setItem(LAST_POS_KEY,JSON.stringify({
        lat:pos.coords.latitude,lon:pos.coords.longitude,
        accuracy:pos.coords.accuracy||null,updatedAt:Date.now()
      }));
    }catch(e){}
    if(isShareEnabled()){
      const ctx=globalThis.myeventCameraContext?.();
      if(ctx?.sb&&ctx?.user){
        ctx.sb.from('social_locations').upsert({
          user_id:ctx.user.id,lat:pos.coords.latitude,lon:pos.coords.longitude,
          accuracy:pos.coords.accuracy||null,share_mode:'exact',updated_at:new Date().toISOString()
        },{onConflict:'user_id'}).then(()=>{}).catch(()=>{});
      }
    }
  }

  async function loadGpsWeather(pos){
    const icon=$('socialGpsWeatherIcon'), temp=$('socialGpsWeatherTemp');
    if(icon)icon.textContent='⏳';
    if(temp)temp.textContent='--°';
    try{
      const lat=pos.coords.latitude,lon=pos.coords.longitude;
      savePosition(pos);
      const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current=temperature_2m,weather_code&timezone=auto');
      if(!r.ok)throw new Error('Météo indisponible');
      const d=await r.json();
      if(icon)icon.textContent=weatherIcon[d.current?.weather_code]||'🌤️';
      if(temp)temp.textContent=Math.round(Number(d.current?.temperature_2m))+'°';
    }catch(e){
      if(icon)icon.textContent='🌤️';
      if(temp)temp.textContent='--°';
    }
  }

  function getPosition(showError){
    if(!navigator.geolocation){
      if(showError)alert('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos=>{
        savePosition(pos);
        loadGpsWeather(pos);
        if($('myeventNearbyInfo') && isShareEnabled())
          $('myeventNearbyInfo').textContent='📍 Position actualisée. Ton choix de partage est mémorisé sur cet appareil.';
      },
      err=>{
        if(showError){
          const msg=err?.code===1
            ?'Autorisation de localisation refusée. Autorise la localisation pour MyEvent dans les réglages du navigateur.'
            :'Impossible d’obtenir ta position pour le moment.';
          if($('myeventNearbyInfo'))$('myeventNearbyInfo').textContent='⚠️ '+msg;
        }
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:300000}
    );
  }

  function openNearby(){
    const p=$('myeventNearbyPanel'); if(!p)return;
    updateShareUI();
    p.classList.add('open'); p.setAttribute('aria-hidden','false');
  }
  function closeNearby(){
    const p=$('myeventNearbyPanel'); if(!p)return;
    p.classList.remove('open'); p.setAttribute('aria-hidden','true');
  }

  function init(){
    updateShareUI();

    $('socialGpsWeatherCard')?.addEventListener('click',()=>getPosition(true));
    $('socialNearbyShareBtn')?.addEventListener('click',openNearby);
    $('closeNearbyPanelBtn')?.addEventListener('click',closeNearby);
    $('myeventNearbyPanel')?.addEventListener('click',e=>{
      if(e.target===$('myeventNearbyPanel'))closeNearby();
    });

    $('myeventNearbyShareToggle')?.addEventListener('change',e=>{
      const on=e.target.checked;
      setShareEnabled(on);
      if(on){
        if($('myeventNearbyInfo'))$('myeventNearbyInfo').textContent='📍 Partage activé. MyEvent pourra utiliser ta position sur cet appareil. Autorise la localisation si le navigateur la demande.';
        getPosition(false);
      }else{
        const ctx=globalThis.myeventCameraContext?.();
        if(ctx?.sb&&ctx?.user)ctx.sb.from('social_locations').upsert({user_id:ctx.user.id,lat:null,lon:null,accuracy:null,share_mode:'off',updated_at:new Date().toISOString()},{onConflict:'user_id'}).then(()=>{}).catch(()=>{});
        if($('myeventNearbyInfo'))$('myeventNearbyInfo').textContent='Partage désactivé. Ton choix est mémorisé et restera désactivé aux prochaines connexions.';
      }
    });

    $('myeventNearbyLocateBtn')?.addEventListener('click',()=>getPosition(true));

    // Si l'utilisateur avait déjà choisi de partager, on ne redemande pas le choix.
    if(isShareEnabled())getPosition(false);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

/* ===== original inline script 28 ===== */
(function(){
  const $=id=>document.getElementById(id);
  let nearbyMap=null, nearbyMeMarker=null, nearbySearchMarker=null, nearbySearchCircle=null, nearbyPlaceLayer=null, nearbyViatorLayer=null, nearbySocialLayer=null, nearbyPlaces=[], nearbyViator=[], nearbyFriends=[], nearbyEvents=[], nearbyFilters=new Set(), nearbyRadiusKm=5, nearbyOrigin=null, nearbySearchCenter=null;

  const wx={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'};

  function bind(id,fn){
    const x=$(id); if(!x)return;
    x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn(e,x);});
  }

  function getAvatarSrc(){
    const root=$('profileAvatar');
    const img=root?.querySelector?.('img');
    if(img?.src)return img.src;
    const alt=$('socialMyAvatar')?.querySelector?.('img');
    return alt?.src||'';
  }

  function markerIcon(){
    const src=getAvatarSrc();
    const html=src
      ? '<div class="myeventMapAvatarMarker"><img src="'+String(src).replace(/"/g,'&quot;')+'" alt=""></div>'
      : '<div class="myeventMapAvatarMarker"><span>👤</span></div>';
    return L.divIcon({className:'',html:html,iconSize:[48,48],iconAnchor:[24,24],popupAnchor:[0,-24]});
  }

  function nearbyEsc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]))}
  function nearbyDistance(a,b,c,d){const R=6371,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,q=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
  function nearbyAvatarIcon(avatar,bg='#6f5cff'){
    const v=String(avatar||''),inner=/^(https?:\/\/|data:image\/)/i.test(v)?'<img src="'+nearbyEsc(v)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':'<span>👤</span>';
    return L.divIcon({className:'',html:'<div style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:'+bg+';border:3px solid #fff;box-shadow:0 2px 9px rgba(0,0,0,.4);overflow:hidden">'+inner+'</div>',iconSize:[40,40],iconAnchor:[20,20],popupAnchor:[0,-20]});
  }
  function nearbyEventIcon(isPrivate){return L.divIcon({className:'',html:'<div class="myeventLeisureMarker">'+(isPrivate?'🔒':'🎉')+'</div>',iconSize:[38,38],iconAnchor:[19,19],popupAnchor:[0,-18]})}
  function updateNearbySearchCircle(){
    if(!nearbyMap||!nearbySearchCenter)return;
    if(nearbySearchCircle)nearbyMap.removeLayer(nearbySearchCircle);
    nearbySearchCircle=L.circle([nearbySearchCenter.lat,nearbySearchCenter.lon],{radius:nearbyRadiusKm*1000,fillOpacity:.05,weight:1.5,color:'#278cff'}).addTo(nearbyMap);
  }
  async function routeMinutes(lat,lon){
    if(!nearbyOrigin||!Number.isFinite(+lat)||!Number.isFinite(+lon))return null;
    try{
      const u='https://router.project-osrm.org/route/v1/driving/'+nearbyOrigin.lon+','+nearbyOrigin.lat+';'+(+lon)+','+(+lat)+'?overview=false';
      const r=await fetch(u),d=await r.json();
      const sec=d?.routes?.[0]?.duration;return Number.isFinite(+sec)?Math.max(1,Math.round(sec/60)):null;
    }catch(e){return null}
  }
  async function geocodeNearbyEvent(place){
    if(!place)return null;
    try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q='+encodeURIComponent(place));const d=await r.json();return d?.[0]?{lat:+d[0].lat,lon:+d[0].lon}:null}catch(e){return null}
  }
  async function loadNearbySocial(){
    const ctx=globalThis.myeventCameraContext?.();
    if(!nearbySearchCenter||!ctx?.sb||!ctx?.user)return;
    const sb=ctx.sb,user=ctx.user;
    try{
      const rel=await sb.from('friendships').select('user_low,user_high').eq('status','accepted');
      const ids=(rel.data||[]).map(x=>x.user_low===user.id?x.user_high:x.user_low).filter(Boolean);
      let profiles=[];if(ids.length){const pr=await sb.rpc('social_friend_profiles',{ids});profiles=pr.data||[]}
      let loc=[];if(ids.length){const lr=await sb.rpc('nearby_friend_locations');loc=lr.data||[]}
      const pm=new Map(profiles.map(x=>[x.id,x])),seen=new Set();
      nearbyFriends=loc.filter(x=>Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)&&!seen.has(x.user_id)&&seen.add(x.user_id)).map(x=>({...x,profile:pm.get(x.user_id)||{}}));
    }catch(e){nearbyFriends=[]}
    try{
      // Existing RLS keeps private event rows member-only. Public discovery may
      // be supplied by the event feed; member events remain available here.
      const er=await sb.from('events').select('id,name,title,location,visibility,start_at,date').limit(100);
      const rows=er.data||[];
      nearbyEvents=(await Promise.all(rows.map(async ev=>{const g=await geocodeNearbyEvent(ev.location);return g?{...ev,...g}:null}))).filter(Boolean);
    }catch(e){nearbyEvents=[]}
    renderNearbySocial();
  }
  function renderNearbySocial(){
    if(!nearbyMap)return;
    if(nearbySocialLayer)nearbySocialLayer.clearLayers();else nearbySocialLayer=L.layerGroup().addTo(nearbyMap);
    const center=nearbySearchCenter;if(!center)return;
    if(!nearbyFilters.size||nearbyFilters.has('friends'))nearbyFriends.forEach(x=>{
      let lat=+x.lat,lon=+x.lon;if(x.share_mode==='approx'){lat=Math.round(lat*100)/100;lon=Math.round(lon*100)/100}
      const p=x.profile||{},m=L.marker([lat,lon],{icon:nearbyAvatarIcon(p.avatar)}).addTo(nearbySocialLayer);
      m.bindPopup('<b>👥 '+nearbyEsc(p.display_name||p.username||'Ami')+'</b><br><span class="nearbyTrip">Calcul du trajet…</span>');
      m.on('popupopen',async()=>{const min=await routeMinutes(lat,lon),el=m.getPopup().getElement()?.querySelector('.nearbyTrip');if(el)el.textContent=min?'🚗 '+min+' min depuis ma position':'Trajet indisponible';});
    });
    if(!nearbyFilters.size||nearbyFilters.has('events'))nearbyEvents.forEach(ev=>{
      if(nearbyDistance(center.lat,center.lon,+ev.lat,+ev.lon)>nearbyRadiusKm)return;
      const priv=String(ev.visibility||'private')==='private',m=L.marker([+ev.lat,+ev.lon],{icon:nearbyEventIcon(priv)}).addTo(nearbySocialLayer);
      m.bindPopup('<b>'+(priv?'🔒 ':'🎉 ')+nearbyEsc(ev.name||ev.title||'Événement')+'</b><br>'+nearbyEsc(ev.location||'')+'<br><span class="nearbyTrip">Calcul du trajet…</span>');
      m.on('popupopen',async()=>{const min=await routeMinutes(+ev.lat,+ev.lon),el=m.getPopup().getElement()?.querySelector('.nearbyTrip');if(el)el.textContent=min?'🚗 '+min+' min depuis ma position':'Trajet indisponible';});
    });
  }
  function setNearbySearchCenter(lat,lon,{fit=false,load=false}={}){
    if(!nearbyMap||!Number.isFinite(+lat)||!Number.isFinite(+lon))return;
    nearbySearchCenter={lat:+lat,lon:+lon};
    if(nearbySearchMarker){nearbyMap.removeLayer(nearbySearchMarker);nearbySearchMarker=null}
    updateNearbySearchCircle();
    if(fit)nearbyMap.setView([+lat,+lon],14,{animate:true});
    if(load)Promise.all([loadNearbyPlaces(+lat,+lon),loadNearbyViator(+lat,+lon),loadNearbySocial()]);
  }

  function nearbyCategory(item){
    const t=String(item?.type||'').toLowerCase();
    if(['restaurant','cafe','fast_food','bar','pub'].some(x=>t.includes(x)))return 'restaurant';
    if(['sport','fitness','stadium','track','pitch','swimming','golf','ice_rink','sports_centre','sports_hall','swimming_pool','golf_course','miniature_golf'].some(x=>t.includes(x)))return 'sport';
    return 'activity';
  }
  function leisureIcon(item){
    const cat=nearbyCategory(item), emoji=cat==='restaurant'?'🍽️':cat==='sport'?'⚽':'🎯';
    return L.divIcon({className:'',html:'<div class="myeventLeisureMarker">'+emoji+'</div>',iconSize:[38,38],iconAnchor:[19,19],popupAnchor:[0,-18]});
  }
  function viatorPhotoIcon(item){
    const src=String(item?.image||'');
    const inner=/^https?:\/\//i.test(src)?'<img src="'+nearbyEsc(src)+'" alt="">':'<span>🎟️</span>';
    return L.divIcon({className:'',html:'<div style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#151515;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);overflow:hidden">'+inner.replace('<img ','<img style="width:100%;height:100%;object-fit:cover" ')+'</div>',iconSize:[48,48],iconAnchor:[24,24],popupAnchor:[0,-24]});
  }
  function renderNearbyViator(){
    if(!nearbyMap)return;
    if(nearbyViatorLayer)nearbyViatorLayer.clearLayers();else nearbyViatorLayer=L.layerGroup().addTo(nearbyMap);
    if(nearbyFilters.size&&!nearbyFilters.has('viator'))return;
    nearbyViator.forEach(item=>{
      if(!Number.isFinite(+item.lat)||!Number.isFinite(+item.lon))return;
      const dist=nearbyOrigin?nearbyDistance(nearbyOrigin.lat,nearbyOrigin.lon,+item.lat,+item.lon):null;
      const price=Number.isFinite(+item.price)?' · dès '+Number(item.price).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}):'';
      const rating=Number.isFinite(+item.rating)?'<br>⭐ '+Number(item.rating).toFixed(1)+(item.reviewCount?' ('+Number(item.reviewCount)+' avis)':''):'';
      const link=item.website||item.productUrl||'';
      const action=link?'<br><a href="'+nearbyEsc(link)+'" target="_blank" rel="noopener">Voir / Réserver</a>':'';
      const m=L.marker([+item.lat,+item.lon],{icon:viatorPhotoIcon(item)}).addTo(nearbyViatorLayer);
      m.bindPopup('<b>🎟️ '+nearbyEsc(item.name||'Activité')+'</b>'+rating+'<br>'+(Number.isFinite(dist)?dist.toFixed(1)+' km depuis ma position':'')+price+action);
    });
  }
  async function loadNearbyViator(lat,lon){
    try{
      const r=await fetch('/api/search-places?mode=viator&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&radius='+encodeURIComponent(nearbyRadiusKm)+'&count=60');
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Activités indisponibles');
      nearbyViator=(Array.isArray(d.results)?d.results:[]).filter(x=>Number.isFinite(+x.lat)&&Number.isFinite(+x.lon));
    }catch(e){nearbyViator=[]}
    renderNearbyViator();
  }

  function renderNearbyPlaces(){
    if(!nearbyMap)return;
    if(nearbyPlaceLayer)nearbyPlaceLayer.clearLayers();
    else nearbyPlaceLayer=L.layerGroup().addTo(nearbyMap);
    const showLeisure=$('nearbyShowLeisureToggle')?.checked!==false;
    if(!showLeisure||(nearbyFilters.size&&![...nearbyFilters].some(x=>['sport','restaurant','activity'].includes(x))))return;
    nearbyPlaces.filter(item=>!nearbyFilters.size||nearbyFilters.has(nearbyCategory(item))).forEach(item=>{
      if(!Number.isFinite(+item.lat)||!Number.isFinite(+item.lon))return;
      const cat=nearbyCategory(item), label=cat==='restaurant'?'Restaurant':cat==='sport'?'Sport':'Loisir';
      const distance=Number.isFinite(+item.distance)?' · '+(+item.distance).toFixed(1)+' km':'';
      L.marker([+item.lat,+item.lon],{icon:leisureIcon(item)}).addTo(nearbyPlaceLayer)
        .bindPopup('<b>'+String(item.name||label).replace(/[<>&"]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[s]))+'</b><br><small>'+label+distance+'</small>');
    });
  }
  async function loadNearbyPlaces(lat,lon){
    if($('nearbyShowLeisureToggle')?.checked===false){nearbyPlaces=[];renderNearbyPlaces();return}
    const toast=$('myeventNearbyToast');
    if(toast)toast.textContent='Recherche autour de toi…';
    try{
      const r=await fetch('/api/search-places?mode=nearby&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&radius='+encodeURIComponent(nearbyRadiusKm));
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Recherche indisponible');
      nearbyPlaces=Array.isArray(d.results)?d.results:[];
      renderNearbyPlaces();
      if(toast)toast.textContent=nearbyPlaces.length?nearbyPlaces.length+' lieux trouvés dans un rayon de '+nearbyRadiusKm+' km':'Aucun lieu trouvé dans un rayon de '+nearbyRadiusKm+' km.';
    }catch(e){
      nearbyPlaces=[];renderNearbyPlaces();
      if(toast)toast.textContent='Les lieux à proximité sont temporairement indisponibles.';
    }
    if(toast)setTimeout(()=>{if(toast.textContent)toast.textContent=''},3500);
  }

  async function searchNearbyFrance(query){
    const q=String(query||'').trim();if(!q)return;
    const toast=$('myeventNearbyToast');
    if(toast)toast.textContent='🔎 Recherche de '+q+'…';
    try{
      const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=fr&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});
      const d=await r.json();
      const hit=Array.isArray(d)?d.find(x=>Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)):null;
      if(!r.ok||!hit)throw new Error('Lieu introuvable');
      setNearbySearchCenter(+hit.lat,+hit.lon,{fit:true,load:true});
      if(toast)toast.textContent='📍 '+(hit.display_name||q);
    }catch(e){
      if(toast)toast.textContent='Aucun lieu trouvé en France pour « '+q+' ».';
    }
    if(toast)setTimeout(()=>{if(toast.textContent)toast.textContent=''},4000);
  }

  function initNearbyMap(lat,lon){
    const node=$('myeventNearbyMap');
    if(!node||!window.L||!Number.isFinite(+lat)||!Number.isFinite(+lon))return;
    if(!nearbyMap){
      nearbyMap=L.map(node,{zoomControl:true,attributionControl:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(nearbyMap);
      nearbyMap.doubleClickZoom.disable();
      nearbyMap.on('dblclick',e=>setNearbySearchCenter(e.latlng.lat,e.latlng.lng,{load:true}));
      let lastTap=0;
      nearbyMap.on('click',e=>{const now=Date.now();if(now-lastTap<420)setNearbySearchCenter(e.latlng.lat,e.latlng.lng,{load:true});lastTap=now;});
    }
    nearbyMap.setView([lat,lon],14);
    nearbyOrigin={lat:+lat,lon:+lon};
    if(nearbyMeMarker)nearbyMap.removeLayer(nearbyMeMarker);
    (async()=>{let avatar=getAvatarSrc();try{const ctx=globalThis.myeventCameraContext?.();if(ctx?.sb&&ctx?.user){const pr=await ctx.sb.from('profiles').select('avatar').eq('id',ctx.user.id).maybeSingle();avatar=pr?.data?.avatar||avatar}}catch(e){} if(nearbyMeMarker)nearbyMap.removeLayer(nearbyMeMarker);nearbyMeMarker=L.marker([lat,lon],{icon:nearbyAvatarIcon(avatar,'#278cff')}).addTo(nearbyMap).bindPopup('<b>📍 Ma position</b>');})();
    if(!nearbySearchCenter)setNearbySearchCenter(+lat,+lon);
    setTimeout(()=>nearbyMap.invalidateSize(),120);
    const searchLat=nearbySearchCenter?.lat??+lat,searchLon=nearbySearchCenter?.lon??+lon;
    loadNearbyPlaces(searchLat,searchLon);
    loadNearbyViator(searchLat,searchLon);
    loadNearbySocial();
  }

  function lastPosition(){
    try{return JSON.parse(localStorage.getItem('myevent_social_last_position_v1')||'null')}catch(e){return null}
  }

  function openNearby(){
    const p=$('myeventNearbyPanel'); if(!p)return;
    p.classList.add('open');p.setAttribute('aria-hidden','false');
    const pos=lastPosition();
    if(pos?.lat&&pos?.lon)initNearbyMap(+pos.lat,+pos.lon);
  }

  function closeNearby(){
    const p=$('myeventNearbyPanel'); if(!p)return;
    p.classList.remove('open');p.setAttribute('aria-hidden','true');
  }

  function dayName(date){
    return new Intl.DateTimeFormat('fr-FR',{weekday:'short'}).format(date).replace('.','');
  }
  function weatherTime(v){return v?new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'--:--'}
  function weatherValue(v,suffix=''){return Number.isFinite(Number(v))?Math.round(Number(v))+suffix:'—'}
  function eventWeatherPlace(){
    const ev=(typeof event!=='undefined'&&event)||null;
    return String(ev?.location||'').trim();
  }
  async function geocodeWeatherPlace(place){
    const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(place)+'&count=1&language=fr&format=json');
    if(!r.ok)throw new Error('Lieu introuvable');
    const d=await r.json(),g=d.results?.[0];
    if(!g)throw new Error('Lieu de l’événement introuvable');
    return {lat:g.latitude,lon:g.longitude,label:[g.name,g.admin1].filter(Boolean).join(', ')};
  }
  async function fetchDetailedWeather(lat,lon){
    const current='temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m';
    const daily='weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset';
    const hourly='temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m';
    const u='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current='+current+'&daily='+daily+'&hourly='+hourly+'&forecast_days=16&timezone=auto';
    const r=await fetch(u); if(!r.ok)throw new Error('Météo indisponible');
    return r.json();
  }
  function renderDetailedWeather(body,d,label,mode,dayIndex=0){
    const cur=d.current||{}, daily=d.daily||{}, hourly=d.hourly||{};
    const days=(daily.time||[]).map((t,i)=>{
      const date=new Date(t+'T12:00:00');
      const weekend=[0,6].includes(date.getDay());
      return '<button type="button" class="myeventWeatherDay" data-weather-day="'+i+'"><b>'+dayName(date)+'</b><span>'+(wx[daily.weather_code?.[i]]||'🌤️')+'</span><small>'+weatherValue(daily.temperature_2m_min?.[i],'°')+' / '+weatherValue(daily.temperature_2m_max?.[i],'°')+'</small><small>🌧️ '+weatherValue(daily.precipitation_probability_max?.[i],'%')+(weekend?' · week-end':'')+'</small></button>';
    }).join('');
    body.innerHTML='<div class="myeventWeatherMode"><button type="button" data-weather-mode="gps" class="'+(mode==='gps'?'active':'')+'">📍 Ma position</button><button type="button" data-weather-mode="event" class="'+(mode==='event'?'active':'')+'">📅 Mon événement</button></div>'+
      '<div class="myeventWeatherNow"><div class="myeventWeatherNowIcon">'+(wx[cur.weather_code]||'🌤️')+'</div><div><div class="myeventWeatherNowTemp">'+weatherValue(cur.temperature_2m,'°C')+'</div><div class="myeventWeatherNowMeta">'+label+'</div><small>Ressenti '+weatherValue(cur.apparent_temperature,'°')+' · 💧 '+weatherValue(cur.relative_humidity_2m,'%')+' · 💨 '+weatherValue(cur.wind_speed_10m,' km/h')+' · 🌧️ '+weatherValue(cur.precipitation,' mm')+'</small></div></div>'+
      '<div class="myeventWeatherForecast">'+days+'</div><div id="myeventWeatherDayDetail"></div>';
    const showDay=i=>{
      const date=daily.time?.[i]; if(!date)return;
      const rows=(hourly.time||[]).map((t,j)=>({t,j})).filter(x=>x.t.startsWith(date)&&Number(x.t.slice(11,13))%3===0).map(x=>'<div class="myeventWeatherHour"><b>'+x.t.slice(11,13)+'h</b><span class="myeventWeatherHourIcon">'+(wx[hourly.weather_code?.[x.j]]||'🌤️')+'</span><strong>'+weatherValue(hourly.temperature_2m?.[x.j],'°')+'</strong><small>Ress. '+weatherValue(hourly.apparent_temperature?.[x.j],'°')+'</small><small>🌧️ '+weatherValue(hourly.precipitation_probability?.[x.j],'%')+'</small><small>💨 '+weatherValue(hourly.wind_speed_10m?.[x.j],' km/h')+'</small></div>').join('');
      const detail=$('myeventWeatherDayDetail'); if(detail)detail.innerHTML='<div class="myeventWeatherDaySummary"><b>'+new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00'))+'</b><span>🌡️ '+weatherValue(daily.temperature_2m_min?.[i],'°')+' / '+weatherValue(daily.temperature_2m_max?.[i],'°')+' · ressenti '+weatherValue(daily.apparent_temperature_min?.[i],'°')+' / '+weatherValue(daily.apparent_temperature_max?.[i],'°')+'</span><span>🌧️ '+weatherValue(daily.precipitation_probability_max?.[i],'%')+' · 💨 '+weatherValue(daily.wind_speed_10m_max?.[i],' km/h')+' · 🌅 '+weatherTime(daily.sunrise?.[i])+' · 🌇 '+weatherTime(daily.sunset?.[i])+'</span></div><div class="myeventWeatherHourly">'+rows+'</div>';
    };
    body.querySelectorAll('[data-weather-day]').forEach(b=>b.addEventListener('click',()=>showDay(Number(b.dataset.weatherDay))));
    body.querySelector('[data-weather-mode="gps"]')?.addEventListener('click',()=>loadWeatherMode('gps',body));
    body.querySelector('[data-weather-mode="event"]')?.addEventListener('click',()=>loadWeatherMode('event',body));
    showDay(dayIndex);
    if(mode==='event'){const title=document.createElement('p');title.textContent=label;body.querySelector('.myeventWeatherNow')?.replaceWith(title);}
  }
  let weatherLoadRun=0;
  async function loadWeatherMode(mode,body){
    const run=++weatherLoadRun;const weatherEvent=mode==='event'&&typeof event!=='undefined'&&event?{...event}:null;
    body.innerHTML='<div class="myeventWeatherLoading">🌤️ Chargement de la météo…</div>';
    try{
      let lat,lon,label;
      if(mode==='event'){
        const place=eventWeatherPlace();
        if(!place)throw new Error('Sélectionne un événement avec un lieu pour afficher sa météo.');
        const g=await geocodeWeatherPlace(place); lat=g.lat;lon=g.lon;label='📅 '+g.label;
      }else{
        if(!navigator.geolocation)throw new Error('La géolocalisation n’est pas disponible.');
        const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:300000}));
        lat=pos.coords.latitude;lon=pos.coords.longitude;label='📍 Météo de ta position GPS';
      }
      const data=await fetchDetailedWeather(lat,lon);let dayIndex=0;
      if(mode==='event'){
        if(typeof event==='undefined'||event?.id!==weatherEvent?.id||run!==weatherLoadRun)return;
        const date=String(weatherEvent?.event_date||'').slice(0,10);
        dayIndex=data.daily?.time?.indexOf(date)??-1;
        if(dayIndex<0)throw Error('Prévision indisponible pour la date de cet événement. Les prévisions couvrent au maximum 16 jours.');
        label+=' · '+date;
      }
      if(run!==weatherLoadRun)return;
      renderDetailedWeather(body,data,label,mode,dayIndex);
    }catch(e){
      if(run!==weatherLoadRun)return;
      const msg=mode==='gps'&&e?.code===1?'Autorise la localisation pour afficher ta météo.':(e?.message||'Impossible de charger la météo pour le moment.');
      body.innerHTML='<div class="myeventWeatherMode"><button type="button" data-weather-mode="gps">📍 Ma position</button><button type="button" data-weather-mode="event">📅 Mon événement</button></div><div class="myeventWeatherLoading">⚠️ '+msg+'</div>';
      body.querySelector('[data-weather-mode="gps"]')?.addEventListener('click',()=>loadWeatherMode('gps',body));
      body.querySelector('[data-weather-mode="event"]')?.addEventListener('click',()=>loadWeatherMode('event',body));
    }
  }
  async function openWeather(){
    const panel=$('myeventPersonalWeatherPanel'), body=$('myeventPersonalWeatherContent');
    if(!panel||!body)return;
    panel.classList.add('open');panel.setAttribute('aria-hidden','false');
    await loadWeatherMode('gps',body);
  }

  function closeWeather(){
    const p=$('myeventPersonalWeatherPanel'); if(!p)return;
    p.classList.remove('open');p.setAttribute('aria-hidden','true');
  }

  function activateNearbyDiscovery(){
    $('myeventNearbySearchForm')?.addEventListener('submit',e=>{
      e.preventDefault();e.stopPropagation();
      searchNearbyFrance($('myeventNearbySearchInput')?.value);
    });
    document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(button=>{
      button.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        const key=button.dataset.nearbyFilter||'all';
        if(key==='all'){
          nearbyFilters.clear();
        }else{
          if(nearbyFilters.has(key))nearbyFilters.delete(key);else nearbyFilters.add(key);
        }
        document.querySelectorAll('#myeventNearbyMapTools [data-nearby-filter]').forEach(x=>{
          const k=x.dataset.nearbyFilter||'all';
          x.classList.toggle('active',k==='all'?!nearbyFilters.size:nearbyFilters.has(k));
        });
        renderNearbyPlaces();
        renderNearbyViator();
        renderNearbySocial();
      });
    });
    $('nearbyShowLeisureToggle')?.addEventListener('change',()=>{
      try{localStorage.setItem('myevent_nearby_leisure_v1',$('nearbyShowLeisureToggle').checked?'1':'0')}catch(e){}
      const pos=lastPosition();
      if($('nearbyShowLeisureToggle').checked&&pos?.lat&&pos?.lon)loadNearbyPlaces(+pos.lat,+pos.lon);else renderNearbyPlaces();
    });
    try{
      const saved=localStorage.getItem('myevent_nearby_leisure_v1');
      if(saved!==null&&$('nearbyShowLeisureToggle'))$('nearbyShowLeisureToggle').checked=saved==='1';
    }catch(e){}
  }

  function activateSocialShortcuts(){
    // Amis : navigation amis.
    document.querySelectorAll('#socialHome .socialStory').forEach(x=>{
      const label=x.textContent.trim();
      if(label==='Amis')x.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        tab('friends');
      });
    });

    // À proximité : ouvre la carte, plus aucun mini-bouton séparé n'est nécessaire.
    document.querySelectorAll('#socialHome .socialStory').forEach(x=>{
      if(x.textContent.trim()==='À proximité')x.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();openNearby();
      });
    });

    // Populaire : sélectionne le filtre correspondant.
    document.querySelectorAll('#socialHome .socialStory').forEach(x=>{
      if(x.textContent.trim()==='Populaire')x.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        const filters=[...document.querySelectorAll('#socialHome .socialFilter')];
        filters.forEach(f=>f.classList.remove('active'));
        const f=filters.find(f=>f.textContent.trim()==='Populaire');
        if(f)f.classList.add('active');
        $('socialFeedView')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });

    // Les 5 filtres sont réellement cliquables et gardent l'état sélectionné.
    document.querySelectorAll('#socialHome .socialFilter').forEach(f=>{
      f.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        document.querySelectorAll('#socialHome .socialFilter').forEach(x=>x.classList.remove('active'));
        f.classList.add('active');
        $('socialFeedView')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });

    bind('socialGpsWeatherCard',openWeather);
    const weatherShortcut=document.querySelector('#socialHome .socialStory.weatherShortcut');
    if(weatherShortcut){
      weatherShortcut.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();openWeather();
      });
    }
    const tempStory=$('socialGpsWeatherTempStory');
    const tempSource=$('socialGpsWeatherTemp');
    if(tempStory&&tempSource){
      const sync=()=>{tempStory.textContent=tempSource.textContent||'--°';};
      sync();
      new MutationObserver(sync).observe(tempSource,{childList:true,characterData:true,subtree:true});
    }
    bind('closePersonalWeatherBtn',closeWeather);
    $('myeventPersonalWeatherPanel')?.addEventListener('click',e=>{
      if(e.target===$('myeventPersonalWeatherPanel'))closeWeather();
    });

    // L'ancien bouton séparé reste compatible, mais n'est plus nécessaire dans l'interface.
    activateNearbyDiscovery();
    bind('socialNearbyShareBtn',openNearby);
    bind('closeNearbyPanelBtn',closeNearby);
    bind('myeventNearbyLocateBtn',()=>{
      if(typeof navigator!=='undefined'&&navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos=>{
          try{localStorage.setItem('myevent_social_last_position_v1',JSON.stringify({lat:pos.coords.latitude,lon:pos.coords.longitude,updatedAt:Date.now()}))}catch(e){}
          initNearbyMap(pos.coords.latitude,pos.coords.longitude);
        });
      }
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',activateSocialShortcuts);
  else activateSocialShortcuts();
})();
