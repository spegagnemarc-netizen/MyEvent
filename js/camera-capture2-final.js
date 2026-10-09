/* ===== original inline script 1 ===== */
(function(){
  function initCameraV2(){
    const modal=document.getElementById('myeventCameraModal');
    if(!modal || modal.dataset.capture2Final==='1') return;
    modal.dataset.capture2Final='1';
    const sheet=modal.querySelector('.cameraProSheet');
    const preview=modal.querySelector('.cameraProPreview');
    const right=modal.querySelector('.cameraSideTools.right');
    const left=modal.querySelector('.cameraSideTools.left');
    if(!sheet||!preview||!right||!left) return;
    sheet.append(right);

    const settings=document.createElement('details');
    settings.className='cameraGlassSettings';
    settings.innerHTML='<summary aria-label="Réglages caméra">⚙</summary><label for="cameraControlOpacity">Transparence des boutons <output id="cameraControlOpacityValue">35 %</output></label><input id="cameraControlOpacity" type="range" min="15" max="70" step="1" value="35" aria-describedby="cameraControlOpacityValue">';
    right.appendChild(settings);modal.cameraSettingsElement=settings;
    const opacityInput=settings.querySelector('input'), opacityValue=settings.querySelector('output');
    const opacityKey='myeventCameraControlOpacity';
    function applyOpacity(value){
      const number=Number(value);
      const percent=Number.isFinite(number)?Math.min(70,Math.max(15,number)):35;
      opacityInput.value=String(percent);
      opacityValue.textContent=percent+' %';
      modal.style.setProperty('--camera-control-opacity',String(percent/100));
      return percent;
    }
    let savedOpacity=35;
    try{const saved=localStorage.getItem(opacityKey);if(saved!==null&&saved.trim()!=='')savedOpacity=saved;}catch(e){}
    applyOpacity(savedOpacity);
    opacityInput.addEventListener('input',()=>{
      const percent=applyOpacity(opacityInput.value);
      try{localStorage.setItem(opacityKey,String(percent));}catch(e){}
    });
    const retake=document.createElement('button');
    retake.type='button';retake.className='cameraRetake';retake.textContent='↻ Reprendre';
    retake.addEventListener('click',()=>modal.dispatchEvent(new Event('camera-retake')));
    sheet.appendChild(retake);

    // Informational tiers: selecting a badge never grants a subscription.
    const tier=document.createElement('div');tier.className='cameraTierSwitch';
    tier.setAttribute('aria-label','Apparence de la caméra');
    tier.innerHTML='<button type="button" data-tier="free" aria-pressed="true">Gratuit</button><button type="button" data-tier="premium" aria-pressed="false"><svg class="cameraPremiumCrown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l5 4 4-7 4 7 5-4-2 12H5z"/></svg> Premium</button><small class="cameraTierNotice">Apparence uniquement</small>';
    modal.dataset.cameraTier='free';
    tier.querySelectorAll('[data-tier]').forEach(button=>button.addEventListener('click',()=>{
      modal.dataset.cameraTier=button.dataset.tier;
      tier.querySelectorAll('[data-tier]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      tier.querySelector('.cameraTierNotice').textContent=button.dataset.tier==='premium'?'Aperçu · offre à venir':'Apparence uniquement';
      modal.dispatchEvent(new Event('camera-editor-layout'));
    }));
    sheet.querySelector('.cameraProTop').appendChild(tier);
    let layoutFrame=0,lastCrop='';
    function viewportGeometry(source){
      const viewport=window.visualViewport,banner=document.getElementById('myeventEnvironmentBanner'),style=getComputedStyle(modal);
      const viewportTop=viewport?.offsetTop||0,top=Math.max(viewportTop,banner?.getBoundingClientRect().bottom||0);
      const height=Math.max(200,(viewport?.height||innerHeight)-(top-viewportTop));
      const safeBottom=parseFloat(style.getPropertyValue('--camera-safe-bottom'))||0;
      const safeLeft=parseFloat(style.getPropertyValue('--camera-safe-left'))||0,safeRight=parseFloat(style.getPropertyValue('--camera-safe-right'))||0;
      const visibleWidth=Math.max(1,modal.clientWidth-safeLeft-safeRight),visibleHeight=Math.max(1,height-56-safeBottom);
      const scale=Math.max(visibleWidth/source.width,visibleHeight/source.height),width=source.width*scale,photoHeight=source.height*scale;
      const left=safeLeft+(visibleWidth-width)/2,photoTop=top+(visibleHeight-photoHeight)/2;
      return {top,height,left,photoTop,width,photoHeight,crop:{x:(safeLeft-left)/scale,y:(top-photoTop)/scale,width:visibleWidth/scale,height:visibleHeight/scale},scale};
    }
    modal.cameraCropExport=source=>{
      const {crop}=viewportGeometry(source),output=document.createElement('canvas');
      output.width=Math.max(1,Math.round(crop.width));output.height=Math.max(1,Math.round(crop.height));
      output.getContext('2d').drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,output.width,output.height);return output;
    };
    function layoutEditor(){
      layoutFrame=0;if(!modal.classList.contains('open'))return;
      const source=modal.cameraGetPhotoSource?.();
      const geometry=viewportGeometry(source||{width:1,height:1});
      modal.style.setProperty('--camera-top',geometry.top+'px');modal.style.setProperty('--camera-height',geometry.height+'px');
      if(modal.cameraHasPhoto?.()){
        const image=modal.querySelector('#myeventCapturedImage'),g=geometry,c=g.crop;
        for(const [key,value] of Object.entries({left:g.left,top:g.photoTop,width:g.width,height:g.photoHeight}))image.style.setProperty('--photo-'+key,value+'px');
        image.style.clipPath=`inset(${c.y*g.scale}px ${(source.width-c.x-c.width)*g.scale}px ${(source.height-c.y-c.height)*g.scale}px ${c.x*g.scale}px)`;
        const key=[source.width,source.height,...Object.values(c)].map(v=>Math.round(v*100)/100).join(':');
        if(lastCrop&&key!==lastCrop)modal.dispatchEvent(new Event('camera-decoration-change'));lastCrop=key;
      }
      modal.dispatchEvent(new Event('camera-editor-layout'));
    }
    modal.cameraResumeEdit=()=>{modal.dataset.cameraEditing='active';modal.dispatchEvent(new Event('camera-editor-layout'));};
    modal.cameraValidateEdit=()=>{modal.dataset.cameraEditing='validated';modal.querySelector('#cameraCreativePanel').hidden=true;modal.dispatchEvent(new Event('camera-editor-layout'));};
    modal.addEventListener('camera-source-reset',()=>{lastCrop='';modal.dataset.cameraEditing='active';});
    function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(layoutEditor);}
    const resize=new ResizeObserver(scheduleLayout);resize.observe(sheet);resize.observe(modal.querySelector('#cameraCapturedActions'));resize.observe(modal.querySelector('#cameraCreativePanel'));
    let observedBanner=null;function observeBanner(){const banner=document.getElementById('myeventEnvironmentBanner');if(banner&&banner!==observedBanner){observedBanner=banner;resize.observe(banner);scheduleLayout();}}
    new MutationObserver(observeBanner).observe(document.body,{childList:true});observeBanner();
    new MutationObserver(scheduleLayout).observe(modal,{attributes:true,attributeFilter:['class','data-camera-state','data-media-kind']});
    new MutationObserver(scheduleLayout).observe(modal.querySelector('#cameraCreativePanel'),{attributes:true,attributeFilter:['hidden','data-kind']});
    window.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('scroll',scheduleLayout);
    modal.addEventListener('camera-preview-ready',scheduleLayout);
    const decorations=window.createCameraAnnotations(modal);
    modal.cameraRenderDecorations=decorations.render;
    modal.cameraRenderStickers=decorations.panel;
    modal.cameraRenderSignatures=decorations.signatures;
    modal.cameraRenderText=host=>decorations.panel(host,'text');
    modal.querySelector('.cameraDecorationTools').prepend(retake);
    const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.id='cameraSettingsBtn';settingsButton.className='cameraProIcon';settingsButton.textContent='⚙';settingsButton.setAttribute('aria-label','Réglages caméra');sheet.querySelector('.cameraProTopRight').append(settingsButton);
    const aiAccess=document.createElement('button');aiAccess.type='button';aiAccess.className='cameraIAAccess';aiAccess.id='cameraIAAccess';aiAccess.textContent='✨ IA';aiAccess.setAttribute('aria-label','Ouvrir les outils IA');
    aiAccess.addEventListener('click',()=>modal.querySelector('#cameraAiSide')?.click());sheet.querySelector('.cameraProTopRight').prepend(aiAccess);

    const strip=document.createElement('div');
    strip.className='cameraFilterStrip cameraFilterFilmstrip';
    const filterItems=[
      ['original','Original'],['naturel','Naturel'],['vif','Vif'],['froid','Froid'],['chaud','Chaud'],['nb','N&B'],['vintage','Vintage'],['cinema','Cinéma'],
      ['doux','Lumineux'],['soleil','Soleil'],['pastel','Pastel'],['noir','Noir'],['argent','Argent'],['sepia','Sépia'],['ambre','Ambre'],['polaire','Polaire'],['mat','Mat'],['eclat','Éclat'],['retro','Rétro'],['crepuscule','Nuit']
    ];
    const filterIcons={original:'◯',naturel:'●',vif:'✹',froid:'❄',chaud:'☀',nb:'◐',vintage:'◍',cinema:'▰'};
    strip.innerHTML=filterItems.map((x,i)=>'<button type="button" class="cameraFilterChip '+(i===0?'active':'')+'" data-filter="'+x[0]+'"><span class="thumb">'+(filterIcons[x[0]]||'◯')+'</span><small>'+x[1]+'</small></button>').join('');
    const filterHost=modal.querySelector('#cameraPanelContent');
    if(filterHost) filterHost.appendChild(strip);
    modal.cameraFilterStrip=strip;

    // Shared definitions for CSS live preview and pixel-based JPEG rendering.
    // No CanvasRenderingContext2D.filter dependency (including iPhone Safari).
    const recipes={original:[],naturel:[['brightness',1.03],['saturate',.96]],vif:[['saturate',1.22],['contrast',1.08]],froid:[['warmth',-12],['contrast',1.03]],chaud:[['warmth',14],['saturate',1.06]],nb:[['grayscale',1],['contrast',1.08]],vintage:[['sepia',.42],['contrast',.94],['saturate',.9]],cinema:[['contrast',1.12],['saturate',.88],['warmth',5]],
      doux:[['contrast',.88],['brightness',1.06]],soleil:[['warmth',22],['brightness',1.06],['saturate',1.12]],
      pastel:[['saturate',.72],['contrast',.88],['brightness',1.08]],noir:[['grayscale',1],['contrast',1.4],['brightness',.92]],
      argent:[['grayscale',1],['contrast',.92],['brightness',1.12]],sepia:[['sepia',1]],ambre:[['sepia',.3],['warmth',20],['contrast',1.05]],
      polaire:[['warmth',-25],['saturate',.8],['brightness',1.06]],mat:[['contrast',.78],['saturate',.88]],eclat:[['contrast',1.18],['saturate',1.32]],
      retro:[['sepia',.6],['saturate',.75],['contrast',.86]],crepuscule:[['warmth',-10],['brightness',.85],['contrast',1.15]]};
    let selectedFilter='original',filterIntensity=1;
    const filterRecipe=name=>(recipes[name]||recipes.original).map(([kind,value])=>[kind,['brightness','contrast','saturate'].includes(kind)?1+(value-1)*filterIntensity:value*filterIntensity]);
    const retouch={brightness:100,contrast:100,saturate:100,warmth:0};
    let beautyAmount=0;
    modal.cameraRenderPhoto=function(source,filter=selectedFilter){
      const output=document.createElement('canvas');output.width=source.width;output.height=source.height;
      const context=output.getContext('2d');context.drawImage(source,0,0);
      const recipe=filterRecipe(filter);
      if(retouch.brightness!==100)recipe.push(['brightness',retouch.brightness/100]);
      if(retouch.contrast!==100)recipe.push(['contrast',retouch.contrast/100]);
      if(retouch.saturate!==100)recipe.push(['saturate',retouch.saturate/100]);
      if(retouch.warmth!==0)recipe.push(['warmth',retouch.warmth]);
      if(beautyAmount>0){const t=beautyAmount/100;recipe.push(['brightness',1+.055*t],['contrast',1-.025*t],['saturate',1-.045*t],['warmth',3*t]);}
      if(!recipe.length)return output;
      const pixels=context.getImageData(0,0,output.width,output.height),data=pixels.data;
      const clamp=value=>Math.min(255,Math.max(0,value));
      for(let i=0;i<data.length;i+=4){
        let r=data[i],g=data[i+1],b=data[i+2];
        for(const [kind,amount] of recipe){
          if(kind==='brightness'){r*=amount;g*=amount;b*=amount;}
          else if(kind==='contrast'){r=(r-127.5)*amount+127.5;g=(g-127.5)*amount+127.5;b=(b-127.5)*amount+127.5;}
          else if(kind==='saturate'||kind==='grayscale'){
            const saturation=kind==='grayscale'?1-amount:amount,luma=.2126*r+.7152*g+.0722*b;
            r=luma+(r-luma)*saturation;g=luma+(g-luma)*saturation;b=luma+(b-luma)*saturation;
          }else if(kind==='warmth'){
            r+=amount*.75;b-=amount*.75;
          }else if(kind==='sepia'){
            const red=r,green=g,blue=b;
            r=red*(1-amount)+(.393*red+.769*green+.189*blue)*amount;
            g=green*(1-amount)+(.349*red+.686*green+.168*blue)*amount;
            b=blue*(1-amount)+(.272*red+.534*green+.131*blue)*amount;
          }
          r=clamp(r);g=clamp(g);b=clamp(b);
        }
        data[i]=r;data[i+1]=g;data[i+2]=b;
      }
      context.putImageData(pixels,0,0);return output;
    };
    modal.cameraRefreshFilterThumbs=function(){
      const raw=modal.cameraGetPhotoSource?.();
      const source=document.createElement('canvas');
      if(raw){const scale=Math.min(1,160/Math.max(raw.width,raw.height));source.width=Math.max(1,Math.round(raw.width*scale));source.height=Math.max(1,Math.round(raw.height*scale));source.getContext('2d').drawImage(raw,0,0,source.width,source.height);}
      else if(modal.querySelector('#myeventCameraVideo')?.readyState>=2)modal.cameraDrawFrame?.(source,160);
      else return;
      if(!source.width||!source.height)return;
      strip.querySelectorAll('.cameraFilterChip').forEach(button=>{const old=button.querySelector('.thumb'),img=document.createElement('img');img.className='thumb';img.alt='';img.src=modal.cameraRenderPhoto(source,button.dataset.filter).toDataURL('image/jpeg',.8);old?.replaceWith(img);});
    };
    // Keep the filter picker lightweight and reliable on iPhone Safari.
    // Thumbnails are prepared only on panel opening, after a decoded frame is available.
    function setFilter(name){
      selectedFilter=Object.hasOwn(recipes,name)?name:'original';
      strip.querySelectorAll('.cameraFilterChip').forEach(b=>{const active=b.dataset.filter===selectedFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      const video=modal.querySelector('#myeventCameraVideo'),img=modal.querySelector('#myeventCapturedImage');
      if(video&&modal.dataset.mediaKind!=='video'&&modal.dataset.captureMode!=='video'){
        const live=filterRecipe(selectedFilter);
        if(retouch.brightness!==100)live.push(['brightness',retouch.brightness/100]);
        if(retouch.contrast!==100)live.push(['contrast',retouch.contrast/100]);
        if(retouch.saturate!==100)live.push(['saturate',retouch.saturate/100]);
        if(retouch.warmth!==0)live.push(['warmth',retouch.warmth]);
        if(beautyAmount>0){const t=beautyAmount/100;live.push(['brightness',1+.055*t],['contrast',1-.025*t],['saturate',1-.045*t],['warmth',3*t]);}
        const ns='http://www.w3.org/2000/svg';
        let svg=modal.querySelector('#cameraLiveFilterSVG');
        if(!svg){svg=document.createElementNS(ns,'svg');svg.id='cameraLiveFilterSVG';svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';modal.append(svg);}
        svg.replaceChildren();const filter=document.createElementNS(ns,'filter');filter.id='cameraLivePhotoFilter';filter.setAttribute('color-interpolation-filters','sRGB');svg.append(filter);
        for(const [kind,amount] of live){
          if(['brightness','contrast','warmth'].includes(kind)){
            const step=document.createElementNS(ns,'feComponentTransfer');
            for(const channel of ['R','G','B']){const fn=document.createElementNS(ns,'feFunc'+channel);fn.setAttribute('type','linear');fn.setAttribute('slope',kind==='warmth'?'1':String(amount));fn.setAttribute('intercept',String(kind==='contrast'?.5*(1-amount):kind==='warmth'?(channel==='R'?amount*.75/255:channel==='B'?-amount*.75/255:0):0));step.append(fn);}filter.append(step);
          }else{
            const step=document.createElementNS(ns,'feColorMatrix');
            if(kind==='sepia'){const t=amount;step.setAttribute('type','matrix');step.setAttribute('values',[(1-t)+.393*t,.769*t,.189*t,0,0,.349*t,(1-t)+.686*t,.168*t,0,0,.272*t,.534*t,(1-t)+.131*t,0,0,0,0,0,1,0].join(' '));}
            else{step.setAttribute('type','saturate');step.setAttribute('values',String(kind==='grayscale'?1-amount:amount));}filter.append(step);
          }
        }
        video.style.filter=live.length?'url(#cameraLivePhotoFilter)':'none';
      }
      if(img)img.style.filter='none'; // The preview file already contains the filter.
      modal.dispatchEvent(new CustomEvent('camera-filter-change',{detail:{filter:selectedFilter}}));
      strip.querySelector('.cameraFilterChip.active')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    }
    strip.querySelectorAll('.cameraFilterChip').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
    modal.cameraSetFilter=setFilter;
    modal.cameraGetFilter=()=>selectedFilter;
    modal.cameraRenderFilters=host=>{
      const groups={'Naturel':['original','naturel','doux'],'Ambiance':['chaud','froid','cinema','soleil','crepuscule'],'Couleur':['vif','pastel','ambre','polaire'],'Noir et blanc':['nb','noir','argent'],'Créatif':['vintage','sepia','mat','eclat','retro']};
      const tabs=document.createElement('div');tabs.className='cameraFilterCategories';
      for(const [label,ids] of [['Tous',filterItems.map(x=>x[0])],...Object.entries(groups)]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(label==='Tous'));button.onclick=()=>{strip.querySelectorAll('[data-filter]').forEach(b=>b.hidden=!ids.includes(b.dataset.filter));tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};tabs.append(button);}
      strip.querySelectorAll('[data-filter]').forEach(b=>b.hidden=false);
      const label=document.createElement('label');label.className='cameraRetouchControl';label.textContent='Intensité du filtre';const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.value=String(filterIntensity*100);range.setAttribute('aria-label','Intensité du filtre');range.oninput=()=>{filterIntensity=Number(range.value)/100;setFilter(selectedFilter);modal.cameraRefreshFilterThumbs();};label.append(range);host.append(tabs,strip,label);modal.cameraRefreshFilterThumbs();
    };
    modal.cameraSetBeauty=value=>{beautyAmount=Math.min(100,Math.max(0,Number(value)||0));setFilter(selectedFilter);};
    modal.cameraGetBeauty=()=>beautyAmount;
    modal.cameraSetRetouch=(key,value)=>{
      if(!(key in retouch))return;
      const limits={brightness:[70,130],contrast:[70,140],saturate:[0,160],warmth:[-40,40]};
      const n=Number(value),range=limits[key];
      if(!Number.isFinite(n)||!range)return;
      retouch[key]=Math.min(range[1],Math.max(range[0],n));
      setFilter(selectedFilter);
    };
    modal.cameraGetRetouch=()=>({...retouch});
    modal.cameraResetRetouch=()=>{Object.assign(retouch,{brightness:100,contrast:100,saturate:100,warmth:0});setFilter(selectedFilter);};
    modal.cameraApplyAutoEnhance=()=>{
      const source=modal.querySelector('#myeventCapturedImage');
      if(!source?.naturalWidth)return false;
      // Conservative local auto-enhancement: improve light/contrast/color without pretending to call a remote AI.
      Object.assign(retouch,{brightness:106,contrast:106,saturate:104,warmth:2});
      setFilter('naturel');
      return true;
    };
    setFilter('original');

    let appearance=null,appearanceLoading=null,panelRequest=0;
    // The small UI module loads on opening Apparence; MediaPipe loads on an effect.
    modal.cameraRenderAppearance=function(host){
      const request=++panelRequest;host.textContent='Ouverture d’Apparence…';
      if(!appearanceLoading)appearanceLoading=import('./camera-appearance.mjs?v=camera-v22-fix-1').then(module=>appearance=module.createAppearance(modal)).catch(error=>{appearanceLoading=null;throw error;});
      appearanceLoading.then(controller=>{
        if(request===panelRequest&&modal.classList.contains('open')&&modal.querySelector('#cameraCreativePanel').dataset.kind==='appearance')controller.renderPanel(host);
      }).catch(()=>{if(request===panelRequest&&modal.querySelector('#cameraCreativePanel').dataset.kind==='appearance')host.textContent='Apparence indisponible. Ferme puis rouvre ce panneau pour réessayer.';});
    };
    modal.cameraComposeAppearance=(source,output)=>appearance?appearance.compose(source,output):output;

    // Direct Lens carousel: one tap/swipe from the viewfinder, no settings panel.
    const lensStrip=document.createElement('div');lensStrip.className='cameraLensStrip';lensStrip.setAttribute('role','group');lensStrip.setAttribute('aria-label','Lens MyEvent');
    const lensItems=[
      [null,'Aucun','ME'],['pig-face','Cochon','🐷'],['toon-face','Cartoon','🤪'],['wild-face','Délire','😜'],['big-eyes','Gros yeux','👀'],['puffy-face','Gonflé','😮'],['reactive-mouth','Bouche','😛']
    ];
    lensStrip.innerHTML=lensItems.map((x,i)=>'<button type="button" class="cameraLens '+(i===0?'active':'')+'" data-lens="'+(x[0]||'')+'" aria-label="'+x[1]+'"><span>'+x[2]+'</span><small>'+x[1]+'</small></button>').join('');
    sheet.appendChild(lensStrip);
    function ensureAppearance(){
      if(!appearanceLoading)appearanceLoading=import('./camera-appearance.mjs?v=camera-v22-fix-1').then(module=>appearance=module.createAppearance(modal)).catch(error=>{appearanceLoading=null;throw error;});
      return appearanceLoading;
    }
    function selectLens(button){
      lensStrip.querySelectorAll('.cameraLens').forEach(x=>{const on=x===button;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});
      button.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
      ensureAppearance().then(controller=>controller.setLens(button.dataset.lens||null)).catch(()=>{button.classList.remove('active');lensStrip.querySelector('.cameraLens[data-lens=""]').classList.add('active');});
    }
    lensStrip.querySelectorAll('.cameraLens').forEach(button=>button.addEventListener('click',()=>selectLens(button)));
    modal.addEventListener('camera-closed',()=>{panelRequest++;const none=lensStrip.querySelector('.cameraLens[data-lens=""]');if(none){lensStrip.querySelectorAll('.cameraLens').forEach(x=>x.classList.toggle('active',x===none));}});



  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCameraV2); else initCameraV2();
})();
