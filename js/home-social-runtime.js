/* ===== original inline script 23 ===== */
(function(){
  function $s(id){return document.getElementById(id)}
  const nav=$s('socialNav')||$s('socialBottomNav');
  const views={feed:$s('socialFeedView'),discover:$s('socialDiscoverView'),friends:$s('socialFriendsView'),messages:$s('socialMessagesView'),notifications:$s('socialGlobalNotificationsView')};
  function tab(name){Object.keys(views).forEach(k=>{if(views[k])views[k].classList.toggle('open',k!=='feed'&&false)});if(views.feed)views.feed.style.display=name==='feed'?'block':'none';if(views.discover)views.discover.style.display=name==='discover'?'block':'none';if(views.friends)views.friends.style.display=name==='friends'?'block':'none';if(views.messages)views.messages.style.display=name==='messages'?'block':'none';document.querySelectorAll('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===name));}
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-social-tab]');if(b)tab(b.dataset.socialTab)});
  // V54.46 — raccourcis du cadre Mes événements
  const headerEvents=$s('socialHeaderEventsBtn');
  headerEvents?.addEventListener('click',()=>{const el=$s('eventsCard');if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'})}});
  $s('socialHeaderCallBtn')?.addEventListener('click',()=>{const el=$s('groupCallCard');if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{if(typeof callActive!=='undefined' && !callActive)$s('startCallBtn')?.click()},250);}});
  $s('socialHeaderNotificationsBtn')?.addEventListener('click',()=>tab('notifications'));
  $s('socialHeaderMessagesBtn')?.addEventListener('click',()=>tab('messages'));
  $s('socialHeaderSearchBtn')?.addEventListener('click',()=>{tab('discover');setTimeout(()=>{$s('socialSearchInput')?.focus();},50);});
  $s('socialCreateStory')?.addEventListener('click',()=>{$s('socialCreateEventBtn')?.click()});
  $s('socialBottomCreate')?.addEventListener('click',()=>openMyEventCamera());
  $s('socialBottomNav')?.addEventListener('click',e=>{const b=e.target.closest('[data-bottom-tab]');if(!b)return;const t=b.dataset.bottomTab;if(t==='profile'){$s('profileAvatar')?.click();return}tab(t==='feed'?'feed':t);$s('socialBottomNav').querySelectorAll('[data-bottom-tab]').forEach(x=>x.classList.toggle('active',x===b));});
  document.querySelectorAll('.socialFilter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.socialFilter').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
  $s('socialCreateEventBtn')?.addEventListener('click',()=>{$s('createEventInlineBtn')?.click();window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})});
  $s('socialExploreBtn')?.addEventListener('click',()=>{tab('discover');setTimeout(()=>window.scrollTo({top:$s('socialHome').offsetTop,behavior:'smooth'}),20)});
  $s('socialSoloBtn')?.addEventListener('click',()=>{tab('feed');$s('socialOpenComposer')?.click();$s('socialPostText').value='🤝 Je cherche des participants pour une sortie !\n\n📍 Lieu :\n📅 Date :\n🎯 Activité :\n👥 Places disponibles :';$s('socialPostText').focus()});
  $s('socialOpenComposer')?.addEventListener('click',()=>{$s('socialComposerPanel').classList.add('open');$s('socialPostText').focus()});
  $s('socialCancelPostBtn')?.addEventListener('click',()=>{$s('socialComposerPanel').classList.remove('open');$s('socialPostMsg').textContent=''});
  $s('socialPublishBtn')?.addEventListener('click',()=>{const text=($s('socialPostText').value||'').trim();if(!text){$s('socialPostMsg').textContent='Écris quelque chose avant de publier.';return;}const name=$s('who')?.textContent||'Moi';const post=document.createElement('article');post.className='socialPost';post.dataset.search=text.toLowerCase();post.innerHTML='<div class="socialPostHead"><div class="socialPostAvatar">👤</div><div class="socialPostMeta"><b></b><span>À l’instant · 🌍 MyEvent</span></div></div><div class="socialPostText"></div><div class="socialActions"><button type="button" class="socialLikeBtn">♡ J’aime <span>0</span></button><button type="button" class="socialCommentBtn">💬 Commenter</button><button type="button" class="socialShareBtn">↗️ Partager</button></div><div class="socialCommentBox"><input placeholder="Écrire un commentaire…"><button type="button">Envoyer</button></div>';post.querySelector('.socialPostMeta b').textContent=name;post.querySelector('.socialPostText').textContent=text;$s('socialFeed').prepend(post);$s('socialPostText').value='';$s('socialComposerPanel').classList.remove('open');$s('socialPostMsg').textContent='Publié.'});
  document.addEventListener('click',e=>{
    const like=e.target.closest('.socialLikeBtn');if(like){let n=parseInt(like.querySelector('span').textContent||'0',10);const active=like.classList.toggle('active');n+=active?1:-1;like.querySelector('span').textContent=n;like.firstChild.textContent=active?'♥ J’aime ':'♡ J’aime ';return}
    const comment=e.target.closest('.socialCommentBtn');if(comment){comment.closest('.socialPost').querySelector('.socialCommentBox').classList.toggle('open');return}
    const interest=e.target.closest('.socialInterestBtn');if(interest){interest.textContent='✅ Intérêt enregistré';interest.classList.add('active');return}
    const follow=e.target.closest('.socialFollowBtn');if(follow){follow.textContent=follow.textContent.includes('Ajouter')?'✓ Demande envoyée':'✓ Ami';follow.classList.add('active');return}
    const accept=e.target.closest('.socialAcceptFriendBtn');if(accept){const card=accept.closest('.socialFriendRequestCard');if(card){card.innerHTML='<div class=\"socialPostAvatar\">🤝</div><b>Ami ajouté</b><div class=\"muted\">Vous êtes maintenant amis sur MyEvent.</div>';};return}
    const decline=e.target.closest('.socialDeclineFriendBtn');if(decline){const card=decline.closest('.socialFriendRequestCard');if(card)card.remove();return}
    const share=e.target.closest('.socialShareBtn');if(share){if(navigator.share){navigator.share({title:'MyEvent',text:'Découvre cet événement sur MyEvent'}).catch(()=>{})}else{navigator.clipboard?.writeText(location.href);share.textContent='✓ Lien copié'}return}
    const send=e.target.closest('.socialCommentBox button');if(send){const box=send.closest('.socialCommentBox'),input=box.querySelector('input');if(input.value.trim()){send.textContent='✓ Envoyé';input.value='';setTimeout(()=>send.textContent='Envoyer',900)}return}
    const msg=e.target.closest('.socialMessageBtn');if(msg){msg.textContent='✓ Messagerie';return}
    const view=e.target.closest('.socialViewEventBtn');if(view){document.getElementById('eventsCard')?.scrollIntoView({behavior:'smooth'});return}
  });
  $s('socialSearchBtn')?.addEventListener('click',()=>{const q=($s('socialSearchInput').value||'').toLowerCase().trim();document.querySelectorAll('#socialDiscoverList .socialEventCard').forEach(c=>c.style.display=(!q||c.textContent.toLowerCase().includes(q))?'block':'none')});
  // Camera controls reuse the existing capture and filter actions.
  let timerSeconds=0,cameraRatio='9:16',countdownToken=0,levelActive=false;
  const cameraSheet=$s('myeventCameraModal')?.querySelector('.cameraProSheet');
  function applyCameraRatio(){
    const [w,h]=cameraRatio.split(':').map(Number),aspect=w/h;
    const width=Math.min(innerWidth,innerHeight*aspect),height=width/aspect;
    cameraSheet?.style.setProperty('--camera-frame-width',width+'px');
    cameraSheet?.style.setProperty('--camera-frame-height',height+'px');
    $s('cameraRatioSide')?.setAttribute('aria-label','Ratio '+cameraRatio);
  }
  window.addEventListener('resize',applyCameraRatio);applyCameraRatio();
  function onCameraOrientation(e){
    if(!levelActive)return;
    const indicator=$s('cameraLevelIndicator');
    if(!indicator)return;
    const angle=screen.orientation?.angle??window.orientation??0;
    const tilt=(angle===90||angle===-90)?e.beta:e.gamma;
    if(typeof tilt!=='number'||!Number.isFinite(tilt)){indicator.classList.add('unavailable');indicator.setAttribute('aria-label','Niveau indisponible');return;}
    indicator.classList.remove('unavailable');indicator.setAttribute('aria-label','Inclinaison '+Math.round(tilt)+' degrés');
    indicator.style.setProperty('--level-angle',Math.max(-45,Math.min(45,tilt))+'deg');
    indicator.classList.toggle('aligned',Math.abs(tilt)<2);
  }
  async function toggleCameraLevel(){
    const button=$s('cameraLevelSide'),indicator=$s('cameraLevelIndicator');
    if(levelActive){levelActive=false;window.removeEventListener('deviceorientation',onCameraOrientation);indicator.hidden=true;button.classList.remove('active');return;}
    if(!indicator.hidden&&indicator.classList.contains('unavailable')){indicator.hidden=true;return;}
    if(typeof DeviceOrientationEvent==='undefined'||!window.isSecureContext){indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','Niveau indisponible sur cet appareil');return;}
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      try{if(await DeviceOrientationEvent.requestPermission()!=='granted'){indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','Autorisation du niveau refusée');return;}}catch(e){indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','Autorisation du niveau indisponible');return;}
    }
    levelActive=true;button.classList.add('active');indicator.hidden=false;indicator.classList.add('unavailable');indicator.setAttribute('data-message','En attente du capteur d’orientation');
    window.addEventListener('deviceorientation',onCameraOrientation);
  }
  function cancelCountdown(){countdownToken++;const el=$s('cameraCountdown');if(el){el.hidden=true;el.textContent='';}}
  const cameraZoom=(function(){
    const sheet=$s('myeventCameraModal')?.querySelector('.cameraProSheet');
    const video=$s('myeventCameraVideo');
    const preview=sheet?.querySelector('.cameraProPreview'), indicator=$s('cameraZoomIndicator');
    let factor=1, track=null, hardware=false, startDistance=0, startFactor=1, hideTimer, zoomRequest=0;
    const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    function display(){
      if(!indicator)return;
      indicator.textContent=factor.toFixed(1)+'×';indicator.classList.add('visible');
      clearTimeout(hideTimer);hideTimer=setTimeout(()=>indicator.classList.remove('visible'),850);
    }
    function set(value){
      factor=Math.min(4,Math.max(1,value));display();
      if(hardware&&track?.readyState==='live'){
        const caps=track.getCapabilities(), zoom=Math.min(caps.zoom.max,Math.max(caps.zoom.min,factor));
        const request=++zoomRequest;
        track.applyConstraints({advanced:[{zoom}]}).then(()=>{
          if(request===zoomRequest)video.style.transform='none';
        }).catch(()=>{hardware=false;video.style.transform=`scale(${factor})`;});
      }else if(video)video.style.transform=`scale(${factor})`;
    }
    preview?.addEventListener('touchstart',e=>{
      if(e.touches.length!==2||e.target.closest('button, input, .cameraCreativePanel'))return;
      startDistance=distance(e.touches);startFactor=factor;e.preventDefault();
    },{passive:false});
    preview?.addEventListener('touchmove',e=>{
      if(e.touches.length!==2||!startDistance)return;
      e.preventDefault();set(startFactor*distance(e.touches)/startDistance);
    },{passive:false});
    preview?.addEventListener('touchend',e=>{if(e.touches.length<2)startDistance=0;});
    const panel=$s('cameraCreativePanel'), content=$s('cameraPanelContent'), title=$s('cameraPanelTitle');
    const filters=content?.querySelector('.cameraFilterStrip');
    const buttons=['cameraAiSide','cameraFilterSide','cameraAppearanceSide','cameraStickerSide','cameraMusicSide','cameraTimerSide','cameraRatioSide'];
    function closePanel(){
      if(panel)panel.hidden=true;
      buttons.forEach(id=>{const b=$s(id);b?.classList.remove('active');b?.setAttribute('aria-expanded','false');});
    }
    function openPanel(kind,source){
      if(!panel||!content)return;
      if(!panel.hidden&&panel.dataset.kind===kind){closePanel();return;}
      closePanel();const settings=sheet?.querySelector('.cameraGlassSettings');if(settings)settings.open=false;panel.hidden=false;panel.dataset.kind=kind;
      source?.classList.add('active');source?.setAttribute('aria-expanded','true');
      const names={ai:'IA photo',filters:'Effets / Filtres',appearance:'Apparence',stickers:'Stickers / Plus',music:'Ajouter un son',timer:'Minuteur',ratio:'Cadrage'};
      title.textContent=names[kind];
      content.replaceChildren();
      if(kind==='filters'){content.appendChild(filters);return;}
      if(kind==='timer'||kind==='ratio'){
        const row=document.createElement('div');row.className='cameraPanelChoices';
        const options=kind==='timer'?[['0','Désactivé'],['3','3 s'],['5','5 s'],['10','10 s']]:[['9:16','9:16'],['4:3','4:3'],['1:1','1:1']];
        options.forEach(([value,label])=>{const choice=document.createElement('button');choice.type='button';choice.textContent=label;choice.classList.toggle('active',value===(kind==='timer'?String(timerSeconds):cameraRatio));choice.addEventListener('click',()=>{if(kind==='timer'){timerSeconds=Number(value);$s('cameraTimerBtn').dataset.timer=value;}else{cameraRatio=value;applyCameraRatio();}closePanel();});row.appendChild(choice);});
        content.appendChild(row);return;
      }
      const descriptions={
        ai:'Traitement IA à connecter. La commande existante est disponible après une photo.',
        appearance:'Cheveux · Barbe · Maquillage · Lunettes · Accessoires · Looks · Transformations créatives IA : à venir.',
        stickers:'Emoji · Stickers · Texte · Décorations : à venir.',
        music:'Le catalogue et le module Musique MyEvent ne sont pas encore connectés.'
      };
      const note=document.createElement('p');note.textContent=descriptions[kind];content.appendChild(note);
      if(kind==='ai'){
        const row=document.createElement('div');row.className='cameraPanelChips';
        ['Auto','Lumière','Netteté','Naturel','Visage / Couleurs'].forEach(label=>{
          const chip=document.createElement('span');chip.textContent=label;chip.title='Traitement à venir';row.appendChild(chip);
        });content.appendChild(row);
        const action=document.createElement('button');action.type='button';action.textContent='Ouvrir l’IA existante';
        action.addEventListener('click',()=>{
          if($s('myeventCameraModal')?.dataset.cameraState==='preview')$s('cameraIaBtn')?.click();
          else note.textContent='Prends ou importe une photo avant d’ouvrir l’IA existante. Traitement à connecter.';
        });content.appendChild(action);
      }
      if(kind==='music'){
        const search=document.createElement('input');search.type='search';search.placeholder='Rechercher un son ou un artiste';search.disabled=true;content.appendChild(search);
        const row=document.createElement('div');row.className='cameraPanelChips';
        ['Pour vous','Tendances','MyEvent','Genres'].forEach(label=>{const chip=document.createElement('span');chip.textContent=label;row.appendChild(chip);});content.appendChild(row);
        const fields=document.createElement('div');fields.className='cameraMusicFields';
        fields.innerHTML='<label>Aperçu / lecture <button type="button" disabled>▶</button></label><label>Choix du son <select disabled><option>Aucun son disponible</option></select></label><label>Extrait <input type="range" disabled></label><label>Volume <input type="range" disabled></label><button type="button" disabled>Utiliser ce son</button>';
        content.appendChild(fields);
      }
    }
    buttons.forEach(id=>$s(id)?.addEventListener('click',e=>openPanel(({cameraAiSide:'ai',cameraFilterSide:'filters',cameraAppearanceSide:'appearance',cameraStickerSide:'stickers',cameraMusicSide:'music'})[id],e.currentTarget)));
    $s('cameraPanelClose')?.addEventListener('click',closePanel);
    sheet?.querySelector('.cameraGlassSettings')?.addEventListener('toggle',e=>{if(e.currentTarget.open)closePanel();});
    $s('cameraGridBtn')?.addEventListener('click',()=> $s('cameraGridOverlay')?.classList.toggle('on'));
    const triggerCamera=(id)=>$s(id)?.click();
    $s('cameraTimerSide')?.addEventListener('click',e=>openPanel('timer',e.currentTarget));
    $s('cameraRatioSide')?.addEventListener('click',e=>openPanel('ratio',e.currentTarget));
    $s('cameraGridSide')?.addEventListener('click',()=>{triggerCamera('cameraGridBtn');});
    $s('cameraLevelSide')?.addEventListener('click',toggleCameraLevel);
    $s('cameraBeautySide')?.addEventListener('click',()=>{if(panel?.hidden||panel?.dataset.kind!=='filters')openPanel('filters',$s('cameraFilterSide'));content?.querySelector('[data-filter="beauty"]')?.click();});
    $s('cameraRetouchSide')?.addEventListener('click',()=>openPanel('appearance',$s('cameraAppearanceSide')));

    $s('cameraFlashBtn')?.addEventListener('click',e=>{e.currentTarget.classList.toggle('active'); e.currentTarget.textContent=e.currentTarget.classList.contains('active')?'⚡':'⚡';});
    $s('cameraSelfieBtn')?.addEventListener('click',()=>{ if(sheet){sheet.classList.add('selfieActive');} });
    $s('cameraRetouchBtn')?.addEventListener('click',()=>{alert('✦ Retouches : module à connecter.');});
    $s('cameraTimerBtn')?.addEventListener('click',()=>openPanel('timer',$s('cameraTimerSide')));
    $s('cameraQualityBtn')?.addEventListener('click',e=>{ const q=e.currentTarget.dataset.q||'Auto'; const next=q==='Auto'?'HD':q==='HD'?'4K':'Auto'; e.currentTarget.dataset.q=next; e.currentTarget.innerHTML=next+' <b>Qualité</b><small>'+next+'</small>'; if($s('cameraQualityLabel'))$s('cameraQualityLabel').textContent=next; });
    return {get factor(){return factor;},get hardware(){return hardware;},
      reset(){factor=1;track=null;hardware=false;zoomRequest++;startDistance=0;if(video)video.style.transform='none';if(indicator)indicator.classList.remove('visible');closePanel();},
      setTrack(newTrack){track=newTrack;let caps;try{caps=track?.getCapabilities?.();}catch(e){}hardware=!!(caps?.zoom&&typeof track.applyConstraints==='function');}};
  })();
  // V54.48 — caméra centrale : selfie/photo d'abord, création d'événement toujours accessible
  let myeventCameraStream=null, myeventFacingMode='user', myeventCapturedDataUrl='';
  const cameraModal=$s('myeventCameraModal'), cameraVideo=$s('myeventCameraVideo'), cameraPlaceholder=$s('cameraPlaceholder'), cameraImg=$s('myeventCapturedImage'), cameraFile=$s('cameraFileInput');
  let cameraRevision=0;
  function resetCameraPreview(){
    cancelCountdown();
    cameraRevision++;
    myeventCapturedDataUrl='';
    cameraModal.dataset.cameraState='viewfinder';
    cameraImg.onload=null;cameraImg.onerror=null;
    cameraImg.removeAttribute('src');cameraImg.style.display='none';
    cameraVideo.style.display='block';
    $s('cameraCapturedActions')?.classList.remove('open');
    return cameraRevision;
  }
  function showCameraPreview(data,revision){
    if(revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
    cameraImg.onload=()=>{
      if(revision!==cameraRevision||!cameraModal.classList.contains('open')||!cameraImg.naturalWidth)return;
      myeventCapturedDataUrl=data;
      cameraImg.style.display='block';cameraVideo.style.display='none';cameraPlaceholder.style.display='none';
      cameraModal.dataset.cameraState='preview';
      $s('cameraCapturedActions')?.classList.add('open');
    };
    cameraImg.onerror=()=>{if(revision===cameraRevision)resetCameraPreview();};
    cameraImg.src=data;
  }
  function stopMyEventCamera(){cameraZoom.reset();if(levelActive){levelActive=false;window.removeEventListener('deviceorientation',onCameraOrientation);$s('cameraLevelIndicator').hidden=true;$s('cameraLevelSide').classList.remove('active');}try{myeventCameraStream?.getTracks().forEach(t=>t.stop())}catch(e){} myeventCameraStream=null;cameraVideo.srcObject=null;}
  async function startMyEventCamera(){
    const revision=resetCameraPreview();stopMyEventCamera();cameraPlaceholder.style.display='grid';
    if(!navigator.mediaDevices?.getUserMedia){cameraPlaceholder.innerHTML='<strong>Caméra non disponible ici</strong><span>Utilise « Galerie » pour prendre un selfie.</span>';return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:myeventFacingMode,width:{ideal:1280},height:{ideal:1280}},audio:false});
      if(revision!==cameraRevision||!cameraModal.classList.contains('open')){stream.getTracks().forEach(t=>t.stop());return;}
      myeventCameraStream=stream;cameraVideo.srcObject=stream;cameraZoom.setTrack(stream.getVideoTracks()[0]);cameraPlaceholder.style.display='none';
    }catch(e){if(revision===cameraRevision){cameraPlaceholder.style.display='grid';cameraPlaceholder.innerHTML='<strong>Autorisation caméra nécessaire</strong><span>Autorise l’appareil photo ou utilise « Galerie ».</span>';}}
  }
  function openMyEventCamera(){cameraModal.classList.add('open');cameraModal.setAttribute('aria-hidden','false');startMyEventCamera();}
  function closeMyEventCamera(){resetCameraPreview();stopMyEventCamera();cameraModal.classList.remove('open');cameraModal.setAttribute('aria-hidden','true');}
  cameraModal?.addEventListener('camera-retake',()=>{if(cameraModal.classList.contains('open'))startMyEventCamera();});
  $s('cameraCloseBtn')?.addEventListener('click',closeMyEventCamera);
  cameraModal?.addEventListener('click',e=>{if(e.target===cameraModal)closeMyEventCamera()});
  function captureMyEventPhoto(){
    if(cameraModal.dataset.cameraState==='preview'){startMyEventCamera();return;}
    if(!myeventCameraStream||cameraVideo.readyState<2||!cameraVideo.videoWidth){cameraFile?.click();return;}
    const z=cameraZoom.factor||1,hardware=cameraZoom.hardware;
    const revision=resetCameraPreview(),c=document.createElement('canvas');
    const [rw,rh]=cameraRatio.split(':').map(Number),ratio=rw/rh;
    const sourceW=cameraVideo.videoWidth,sourceH=cameraVideo.videoHeight;
    c.width=sourceW;c.height=Math.round(sourceW/ratio);
    if(c.height>sourceH){c.height=sourceH;c.width=Math.round(sourceH*ratio);}
    // Crop the visible central frame; hardware zoom is already part of the track.
    const cropZoom=hardware?1:z,w=c.width/cropZoom,h=c.height/cropZoom;
    c.getContext('2d').drawImage(cameraVideo,(sourceW-w)/2,(sourceH-h)/2,w,h,0,0,c.width,c.height);
    showCameraPreview(c.toDataURL('image/jpeg',.9),revision);
  }
  $s('cameraShutterBtn')?.addEventListener('click',()=>{
    if(cameraModal.dataset.cameraState==='preview'||!timerSeconds||!myeventCameraStream||cameraVideo.readyState<2){captureMyEventPhoto();return;}
    if(!$s('cameraCountdown').hidden){cancelCountdown();return;}
    const token=++countdownToken,revision=cameraRevision,el=$s('cameraCountdown');
    el.hidden=false;el.textContent=String(timerSeconds);
    let remaining=timerSeconds;
    const tick=()=>{if(token!==countdownToken||revision!==cameraRevision||!cameraModal.classList.contains('open'))return;
      remaining--;if(remaining>0){el.textContent=String(remaining);setTimeout(tick,1000);}else{el.hidden=true;captureMyEventPhoto();}};
    setTimeout(tick,1000);
  });
  $s('cameraGalleryBtn')?.addEventListener('click',()=>cameraFile?.click());
  cameraFile?.addEventListener('change',()=>{
    const f=cameraFile.files?.[0];if(!f)return;
    const revision=resetCameraPreview(),reader=new FileReader();
    reader.onload=()=>showCameraPreview(reader.result,revision);
    reader.readAsDataURL(f);cameraFile.value='';
  });
  $s('cameraFlipBtn')?.addEventListener('click',()=>{myeventFacingMode=myeventFacingMode==='user'?'environment':'user';startMyEventCamera()});
  $s('cameraIaBtn')?.addEventListener('click',()=>{if(!myeventCapturedDataUrl){cameraFile?.click();return;}alert('✨ IA photo : module IA à connecter. La photo est prête pour le traitement.');});
  $s('cameraVideoBtn')?.addEventListener('click',()=>{alert('🎬 Le mode vidéo sera activé dans la prochaine étape.');});
  $s('cameraEventBtn')?.addEventListener('click',()=>{closeMyEventCamera();$s('socialCreateEventBtn')?.click()});
  $s('cameraPublishBtn')?.addEventListener('click',()=>{if(!myeventCapturedDataUrl)return;const post=document.createElement('article');post.className='socialPost';post.innerHTML='<div class="socialPostHead"><div class="socialPostAvatar">📸</div><div class="socialPostMeta"><b>Moi</b><span>À l’instant · 📍 MyEvent</span></div></div><div class="socialPostText">📸 Nouveau moment partagé sur MyEvent.</div><img src="'+myeventCapturedDataUrl+'" alt="Photo MyEvent" style="display:block;width:100%;max-height:430px;object-fit:cover;border-top:1px solid #2a3035;border-bottom:1px solid #2a3035"><div class="socialActions"><button type="button" class="socialLikeBtn">♡ J’aime <span>0</span></button><button type="button" class="socialCommentBtn">💬 Commenter</button><button type="button" class="socialShareBtn">↗️ Partager</button></div><div class="socialCommentBox"><input placeholder="Écrire un commentaire…"><button type="button">Envoyer</button></div>';$s('socialFeed')?.prepend(post);closeMyEventCamera();});
  $s('cameraAttachEventBtn')?.addEventListener('click',()=>{closeMyEventCamera();$s('eventsCard')?.scrollIntoView({behavior:'smooth',block:'start'})});
  $s('socialBackToFeedBtn')?.addEventListener('click',()=>tab('feed'));
  $s('socialGlobalFriendsBtn')?.addEventListener('click',()=>tab('friends'));
  $s('socialGlobalEventsBtn')?.addEventListener('click',()=>{const el=$s('eventsCard');if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'})}});
  // Apparence de l’accueil : sauvegarde locale, sans modifier les écrans d’événement.
  function applyHomeAppearance(){
    const root=$s('socialHome'); if(!root)return;
    const bg=localStorage.getItem('myeventHomeBg')||'dark';
    const accent=localStorage.getItem('myeventHomeAccent')||'#ff6a34';
    root.classList.toggle('socialLight',bg==='light');
    root.style.setProperty('--social-accent',accent);
    document.querySelectorAll('.myeventAppearanceChoice').forEach(b=>b.classList.toggle('active',b.dataset.homeBg===bg));
    document.querySelectorAll('.myeventAccent').forEach(b=>b.classList.toggle('active',b.dataset.accent===accent));
  }
  document.querySelectorAll('.myeventAppearanceChoice').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('myeventHomeBg',b.dataset.homeBg);applyHomeAppearance()}));
  document.querySelectorAll('.myeventAccent').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('myeventHomeAccent',b.dataset.accent);applyHomeAppearance()}));
  applyHomeAppearance();
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

    // INVITER DES CONTACTS : feuille de partage iPhone/Android quand disponible.
    bind('invitePhoneContactsBtn',async()=>{
      const data={
        title:'Rejoins-moi sur MyEvent',
        text:'Viens rejoindre mes amis sur MyEvent pour organiser et partager nos événements.',
        url:location.href
      };
      try{
        if(navigator.share) await navigator.share(data);
        else alert('Utilise le bouton Partager de ton téléphone pour inviter tes contacts.');
      }catch(e){}
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
  let nearbyMap=null, nearbyMeMarker=null;

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

  function initNearbyMap(lat,lon){
    const node=$('myeventNearbyMap');
    if(!node||!window.L||!Number.isFinite(+lat)||!Number.isFinite(+lon))return;
    if(!nearbyMap){
      nearbyMap=L.map(node,{zoomControl:true,attributionControl:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(nearbyMap);
    }
    nearbyMap.setView([lat,lon],14);
    if(nearbyMeMarker)nearbyMap.removeLayer(nearbyMeMarker);
    nearbyMeMarker=L.marker([lat,lon],{icon:markerIcon()}).addTo(nearbyMap).bindPopup('<b>📍 Ma position</b>').openPopup();
    setTimeout(()=>nearbyMap.invalidateSize(),120);
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

  async function openWeather(){
    const panel=$('myeventPersonalWeatherPanel'), body=$('myeventPersonalWeatherContent');
    if(!panel||!body)return;
    panel.classList.add('open');panel.setAttribute('aria-hidden','false');
    body.innerHTML='<div class="myeventWeatherLoading">📍 Recherche de ta position…</div>';
    if(!navigator.geolocation){body.innerHTML='<div class="myeventWeatherLoading">La géolocalisation n’est pas disponible.</div>';return}
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude,lon=pos.coords.longitude;
      body.innerHTML='<div class="myeventWeatherLoading">🌤️ Chargement de la météo…</div>';
      try{
        const u='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto';
        const r=await fetch(u); if(!r.ok)throw Error();
        const d=await r.json();
        const cur=d.current||{}, daily=d.daily||{};
        const days=(daily.time||[]).map((t,i)=>'<div class="myeventWeatherDay"><b>'+dayName(new Date(t+'T12:00:00'))+'</b><span>'+(wx[daily.weather_code?.[i]]||'🌤️')+'</span><small>'+Math.round(daily.temperature_2m_min?.[i]??0)+'° / '+Math.round(daily.temperature_2m_max?.[i]??0)+'°</small></div>').join('');
        body.innerHTML='<div class="myeventWeatherNow"><div class="myeventWeatherNowIcon">'+(wx[cur.weather_code]||'🌤️')+'</div><div><div class="myeventWeatherNowTemp">'+Math.round(Number(cur.temperature_2m))+'°C</div><div class="myeventWeatherNowMeta">Météo de ta position GPS</div></div></div><div class="myeventWeatherForecast">'+days+'</div>';
      }catch(e){
        body.innerHTML='<div class="myeventWeatherLoading">Impossible de charger la météo pour le moment.</div>';
      }
    },()=>{
      body.innerHTML='<div class="myeventWeatherLoading">⚠️ Autorise la localisation pour afficher ta météo.</div>';
    },{enableHighAccuracy:true,timeout:15000,maximumAge:300000});
  }

  function closeWeather(){
    const p=$('myeventPersonalWeatherPanel'); if(!p)return;
    p.classList.remove('open');p.setAttribute('aria-hidden','true');
  }

  function activateSocialShortcuts(){
    // Ma story : ouvre la création de story/photo existante.
    const story=$('socialCreateStory')?.parentElement?.querySelector('.socialStory.me');
    if(story){
      story.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        const camera=$('socialOpenComposer');
        if(camera)camera.click();
        else if(typeof window.openMyEventCamera==='function')window.openMyEventCamera();
      });
    }

    // Amis : navigation amis.
    document.querySelectorAll('#socialHome .socialStory').forEach(x=>{
      const label=x.textContent.trim();
      if(label==='Amis')x.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        const b=document.querySelector('[data-bottom-tab="friends"]'); if(b)b.click();
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
