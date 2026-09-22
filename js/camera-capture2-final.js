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
    const topRight=modal.querySelector('.cameraProTopRight');
    if(!sheet||!preview||!right||!left) return;

    const settings=document.createElement('details');
    settings.className='cameraGlassSettings';
    settings.innerHTML='<summary aria-label="Réglages caméra">⚙</summary><label for="cameraControlOpacity">Transparence des boutons <output id="cameraControlOpacityValue">35 %</output></label><input id="cameraControlOpacity" type="range" min="15" max="70" step="1" value="35" aria-describedby="cameraControlOpacityValue">';
    sheet.appendChild(settings);
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
    sheet.appendChild(tier);

    const quality=document.createElement('div');
    quality.className='cameraQualityBar';
    quality.innerHTML='<button class="active">RAW</button><button>HD</button><button>4K</button><button>8K</button>';
    preview.appendChild(quality);

    const premiumBar=document.createElement('div');
    premiumBar.className='cameraPremiumBar';
    premiumBar.innerHTML='<span>♛</span><b>Mode Premium</b><span style="color:#92979d">IA avancée · qualité pro · retouches avancées</span>';
    sheet.appendChild(premiumBar);

    function addTool(parent,id,icon,label,extra){
      if(document.getElementById(id)) return;
      const b=document.createElement('button');
      b.type='button'; b.className='cameraSideTool'+(extra?' premiumOnly':''); b.id=id;
      b.innerHTML=icon+'<small>'+label+'</small>';
      parent.appendChild(b);
    }
    addTool(left,'cameraStabilizeSide','◌','Stabilisation',true);
    addTool(left,'cameraRawSide','RAW','RAW',true);
    addTool(right,'cameraBackgroundSide','▧','Arrière-plan',true);
    addTool(right,'cameraStyleSide','◉','Style',true);
    addTool(right,'cameraMoreSide','•••','Plus',true);

    const strip=document.createElement('div');
    strip.className='cameraFilterStrip';
    strip.innerHTML=[
      ['original','◯','Original'],['naturel','●','Naturel'],['portrait','◉','Portrait'],['nb','◐','Noir & blanc'],['cartoon','✦','Cartoon'],['anime','◈','Anime'],['vintage','◍','Vintage'],['beauty','☺','Beauté']
    ].map((x,i)=>'<button type="button" class="cameraFilterChip '+(i===0?'active':'')+'" data-filter="'+x[0]+'"><span class="thumb">'+x[1]+'</span>'+x[2]+'</button>').join('');
    const modes=sheet.querySelector('.cameraProModes');
    if(modes) sheet.insertBefore(strip,modes);

    function setFilter(name){
      strip.querySelectorAll('.cameraFilterChip').forEach(b=>b.classList.toggle('active',b.dataset.filter===name));
      const video=document.getElementById('myeventCameraVideo'), img=document.getElementById('myeventCapturedImage');
      const map={original:'none',naturel:'brightness(1.03) saturate(.96)',portrait:'contrast(1.04) saturate(1.03)',nb:'grayscale(1)',cartoon:'saturate(1.45) contrast(1.12)',anime:'saturate(1.28) brightness(1.06) contrast(1.04)',vintage:'sepia(.42) contrast(.94)',beauty:'brightness(1.07) saturate(.94) contrast(.98)'};
      const f=map[name]||'none';
      if(video) video.style.filter=f; if(img) img.style.filter=f;
    }
    strip.querySelectorAll('.cameraFilterChip').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));

    tier.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      const premium=btn.dataset.tier==='premium';
      tier.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));
      sheet.classList.toggle('cameraPremiumMode',premium);
      // Gold is reserved for selected IA/Premium controls.
    }));

    // Make the top flash/grid buttons neutral; preserve their existing behavior.
    [topRight,...topRight?.querySelectorAll('button')||[]].forEach(()=>{});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCameraV2); else initCameraV2();
})();
