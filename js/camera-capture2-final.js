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

    const settings=document.createElement('details');
    settings.className='cameraGlassSettings';
    settings.innerHTML='<summary aria-label="Réglages caméra">⚙</summary><label for="cameraControlOpacity">Transparence des boutons <output id="cameraControlOpacityValue">35 %</output></label><input id="cameraControlOpacity" type="range" min="15" max="70" step="1" value="35" aria-describedby="cameraControlOpacityValue">';
    right.appendChild(settings);
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

    // Tier switch: visual test now; later bind to the real subscription flag.
    const tier=document.createElement('div');
    tier.className='cameraTierSwitch';
    tier.innerHTML='<button type="button" data-tier="free" class="active">GRATUIT</button><button type="button" data-tier="premium">♛ PREMIUM</button>';
    sheet.querySelector('.cameraProTop').appendChild(tier);

    const strip=document.createElement('div');
    strip.className='cameraFilterStrip';
    strip.innerHTML=[
      ['original','◯','Original'],['naturel','●','Naturel'],['portrait','◉','Portrait'],['nb','◐','Noir & blanc'],['cartoon','✦','Cartoon'],['anime','◈','Anime'],['vintage','◍','Vintage'],['beauty','☺','Beauté']
    ].map((x,i)=>'<button type="button" class="cameraFilterChip '+(i===0?'active':'')+'" data-filter="'+x[0]+'"><span class="thumb">'+x[1]+'</span>'+x[2]+'</button>').join('');
    const filterHost=modal.querySelector('#cameraPanelContent');
    if(filterHost) filterHost.appendChild(strip);
    modal.cameraFilterStrip=strip;

    // Shared definitions for CSS live preview and pixel-based JPEG rendering.
    // No CanvasRenderingContext2D.filter dependency (including iPhone Safari).
    const recipes={original:[],naturel:[['brightness',1.03],['saturate',.96]],portrait:[['contrast',1.04],['saturate',1.03]],nb:[['grayscale',1]],cartoon:[['saturate',1.45],['contrast',1.12]],anime:[['saturate',1.28],['brightness',1.06],['contrast',1.04]],vintage:[['sepia',.42],['contrast',.94]],beauty:[['brightness',1.07],['saturate',.94],['contrast',.98]]};
    let selectedFilter='original';
    modal.cameraRenderPhoto=function(source){
      const output=document.createElement('canvas');output.width=source.width;output.height=source.height;
      const context=output.getContext('2d');context.drawImage(source,0,0);
      const recipe=recipes[selectedFilter];
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
    function setFilter(name){
      selectedFilter=Object.hasOwn(recipes,name)?name:'original';
      strip.querySelectorAll('.cameraFilterChip').forEach(b=>{const active=b.dataset.filter===selectedFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      const video=modal.querySelector('#myeventCameraVideo'),img=modal.querySelector('#myeventCapturedImage');
      if(video)video.style.filter=recipes[selectedFilter].map(([kind,value])=>kind+'('+value+')').join(' ')||'none';
      if(img)img.style.filter='none'; // The preview file already contains the filter.
      modal.dispatchEvent(new CustomEvent('camera-filter-change',{detail:{filter:selectedFilter}}));
    }
    strip.querySelectorAll('.cameraFilterChip').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
    setFilter('original');

    let appearance=null,appearanceLoading=null,panelRequest=0;
    // The small UI module loads on opening Apparence; MediaPipe loads on an effect.
    modal.cameraRenderAppearance=function(host){
      const request=++panelRequest;host.textContent='Ouverture d’Apparence…';
      if(!appearanceLoading)appearanceLoading=import('./camera-appearance.mjs').then(module=>appearance=module.createAppearance(modal)).catch(error=>{appearanceLoading=null;throw error;});
      appearanceLoading.then(controller=>{
        if(request===panelRequest&&modal.classList.contains('open')&&modal.querySelector('#cameraCreativePanel').dataset.kind==='appearance')controller.renderPanel(host);
      }).catch(()=>{if(request===panelRequest&&modal.querySelector('#cameraCreativePanel').dataset.kind==='appearance')host.textContent='Apparence indisponible. Ferme puis rouvre ce panneau pour réessayer.';});
    };
    modal.cameraComposeAppearance=(source,output)=>appearance?appearance.compose(source,output):output;

    // Direct Lens carousel: one tap/swipe from the viewfinder, no settings panel.
    const lensStrip=document.createElement('div');lensStrip.className='cameraLensStrip';lensStrip.setAttribute('role','group');lensStrip.setAttribute('aria-label','Lens MyEvent');
    const lensItems=[
      [null,'Aucun','ME'],['toon-face','Cartoon','🤪'],['wild-face','Délire','😜'],['big-eyes','Gros yeux','👀'],['puffy-face','Gonflé','😮'],['reactive-mouth','Bouche','😛']
    ];
    lensStrip.innerHTML=lensItems.map((x,i)=>'<button type="button" class="cameraLens '+(i===0?'active':'')+'" data-lens="'+(x[0]||'')+'" aria-label="'+x[1]+'"><span>'+x[2]+'</span><small>'+x[1]+'</small></button>').join('');
    sheet.appendChild(lensStrip);
    function ensureAppearance(){
      if(!appearanceLoading)appearanceLoading=import('./camera-appearance.mjs').then(module=>appearance=module.createAppearance(modal)).catch(error=>{appearanceLoading=null;throw error;});
      return appearanceLoading;
    }
    function selectLens(button){
      lensStrip.querySelectorAll('.cameraLens').forEach(x=>{const on=x===button;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});
      button.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
      ensureAppearance().then(controller=>controller.setLens(button.dataset.lens||null)).catch(()=>{button.classList.remove('active');lensStrip.querySelector('.cameraLens[data-lens=""]').classList.add('active');});
    }
    lensStrip.querySelectorAll('.cameraLens').forEach(button=>button.addEventListener('click',()=>selectLens(button)));
    modal.addEventListener('camera-closed',()=>{panelRequest++;const none=lensStrip.querySelector('.cameraLens[data-lens=""]');if(none){lensStrip.querySelectorAll('.cameraLens').forEach(x=>x.classList.toggle('active',x===none));}});

    tier.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      const premium=btn.dataset.tier==='premium';
      tier.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));
      sheet.classList.toggle('cameraPremiumMode',premium);
      // Gold is reserved for selected IA/Premium controls.
    }));

  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCameraV2); else initCameraV2();
})();
