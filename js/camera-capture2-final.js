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

    const appearanceCategories=[['hair','Cheveux'],['beard','Barbe'],['makeup','Maquillage'],['glasses','Lunettes'],['accessories','Accessoires'],['looks','Looks'],['creative-ai','Créatif IA']];
    let appearanceCategory='hair';
    // Selection is an integration event, never a claim that a treatment ran.
    modal.cameraRenderAppearance=function(host){
      const row=document.createElement('div');row.className='cameraAppearanceCategories';row.setAttribute('role','group');row.setAttribute('aria-label','Catégories Apparence');
      const status=document.createElement('p');status.className='cameraAppearanceStatus';status.setAttribute('role','status');
      const action=document.createElement('button');action.type='button';action.disabled=true;action.textContent='Traitement IA non connecté';
      function select(id,label,notify){
        appearanceCategory=id;
        row.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===id)));
        status.textContent=label+' : aucun traitement connecté. La photo reste inchangée.';
        if(notify)modal.dispatchEvent(new CustomEvent('camera-appearance-select',{detail:{category:id,connected:false}}));
      }
      appearanceCategories.forEach(([id,label])=>{
        const button=document.createElement('button');button.type='button';button.dataset.category=id;button.textContent=label;
        button.addEventListener('click',()=>select(id,label,true));row.appendChild(button);
      });
      host.append(row,status,action);
      select(appearanceCategory,appearanceCategories.find(([id])=>id===appearanceCategory)[1],false);
    };

    tier.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      const premium=btn.dataset.tier==='premium';
      tier.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));
      sheet.classList.toggle('cameraPremiumMode',premium);
      // Gold is reserved for selected IA/Premium controls.
    }));

  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCameraV2); else initCameraV2();
})();
