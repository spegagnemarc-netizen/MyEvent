import {FaceEngine} from './camera-face-engine.mjs';
import {categories,effects,hasEffects,drawAppearance,selectedWarp} from './camera-appearance-renderer.mjs?v=ai-lenses-1';
import {FaceWarpRenderer} from './camera-face-warp.mjs';

export function createAppearance(modal){
  const video=modal.querySelector('#myeventCameraVideo'),sheet=modal.querySelector('.cameraProSheet');
  let selection={fun:null,glasses:null,accessories:null,makeup:null},category='glasses';
  let engine=null,overlay=null,warpCanvas=null,warpRenderer=null,frame=null,notice=null,timer=0,epoch=0,photoEpoch=0,busy=false,lastVideoTime=-1;
  let interval=1000/12,average=0,cache=new WeakMap(),failed=false,status='Choisis un effet local.';
  function setStatus(text){
    status=text;
    const panel=modal.querySelector('.cameraAppearanceStatus');if(panel&&effects[category])panel.textContent=text;
    if(notice){notice.textContent=text;notice.hidden=!hasEffects(selection);}
  }
  function active(){return modal.classList.contains('open')&&hasEffects(selection)&&!document.hidden;}
  function clearOverlay(){if(overlay){overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);overlay.hidden=true;}if(warpCanvas)warpCanvas.hidden=true;}
  function stopLive(){clearTimeout(timer);timer=0;epoch++;clearOverlay();}
  function release(){
    photoEpoch++;stopLive();engine?.close();engine=null;cache=new WeakMap();failed=false;average=0;interval=1000/12;lastVideoTime=-1;
    if(frame){frame.width=frame.height=0;frame=null;}
    if(overlay){overlay.width=overlay.height=0;overlay.remove();overlay=null;}
    warpRenderer?.close();warpRenderer=null;if(warpCanvas){warpCanvas.width=warpCanvas.height=0;warpCanvas.remove();warpCanvas=null;}
    notice?.remove();notice=null;
  }
  function ensureSurfaces(){
    if(!overlay){overlay=document.createElement('canvas');overlay.className='cameraAppearanceOverlay';overlay.setAttribute('aria-hidden','true');overlay.hidden=true;sheet.appendChild(overlay);}
    if(!warpCanvas){warpCanvas=document.createElement('canvas');warpCanvas.className='cameraAppearanceWarp';warpCanvas.setAttribute('aria-hidden','true');warpCanvas.hidden=true;sheet.appendChild(warpCanvas);}
    if(!notice){notice=document.createElement('p');notice.className='cameraAppearanceNotice';notice.setAttribute('role','status');sheet.appendChild(notice);}
  }
  function getEngine(){
    if(!engine){engine=new FaceEngine();setStatus('Chargement du suivi local…');}
    return engine;
  }
  function schedule(delay=0){
    clearTimeout(timer);
    if(active()&&!failed&&modal.dataset.cameraState==='viewfinder')timer=setTimeout(tick,delay);
  }
  async function tick(){
    timer=0;
    if(!active()||failed||modal.dataset.cameraState!=='viewfinder')return;
    if(busy||video.readyState<2||video.currentTime===lastVideoTime){schedule(interval);return;}
    busy=true;const generation=epoch,started=performance.now();
    try{
      ensureSurfaces();if(!frame)frame=document.createElement('canvas');
      modal.cameraDrawFrame(frame,640);lastVideoTime=video.currentTime;
      const current=getEngine(),warmed=current.backend!=='loading',points=await current.detect(frame,'VIDEO');
      if(generation!==epoch||!active()||modal.dataset.cameraState!=='viewfinder')return;
      overlay.width=frame.width;overlay.height=frame.height;
      const warp=selectedWarp(selection);
      if(points&&warp){if(!warpRenderer)warpRenderer=new FaceWarpRenderer(warpCanvas);warpRenderer.render(frame,points,warp,frame.width,frame.height);warpCanvas.hidden=false;}else if(warpCanvas)warpCanvas.hidden=true;
      drawAppearance(overlay.getContext('2d'),points,selection,overlay.width,overlay.height);overlay.hidden=!points;
      setStatus(points?'Apparence locale active':'Aucun visage détecté — effet masqué.');
      // Start near 12 Hz. Spend at most ~55% of time on inference; fallback caps at 8 Hz.
      const elapsed=warmed?Math.min(1000,performance.now()-started):0;average=average?average*.8+elapsed*.2:elapsed;
      interval=Math.max(current.backend==='main'?125:1000/12,Math.min(1000,average/0.55));
    }catch(error){
      if(generation===epoch&&error.name!=='AbortError'){
        failed=true;engine?.close();engine=null;clearOverlay();setStatus('Suivi indisponible. Réessaie un effet ou choisis Aucun.');
      }
    }finally{busy=false;schedule(Math.max(0,interval-(performance.now()-started)));}
  }
  function setLens(id){selection.fun=id||null;changed();modal.dispatchEvent(new CustomEvent('camera-lens-state',{detail:{lens:selection.fun}}));}
  function changed(){
    photoEpoch++;failed=false;cache=new WeakMap();stopLive();
    if(!hasEffects(selection)){release();setStatus('Aucun effet Apparence.');}
    else{ensureSurfaces();setStatus('Recherche du visage…');schedule();}
    modal.dispatchEvent(new CustomEvent('camera-appearance-change',{detail:{...selection}}));
  }
  function renderPanel(host){
    host.replaceChildren();
    const row=document.createElement('div');row.className='cameraAppearanceCategories';row.setAttribute('role','group');row.setAttribute('aria-label','Catégories Apparence');
    const choices=document.createElement('div');choices.className='cameraAppearanceEffects';choices.setAttribute('role','group');choices.setAttribute('aria-label','Effets locaux');
    const message=document.createElement('p');message.className='cameraAppearanceStatus';message.setAttribute('role','status');
    const reset=document.createElement('button');reset.type='button';reset.textContent='Retirer tous les effets';
    reset.addEventListener('click',()=>{selection={fun:null,glasses:null,accessories:null,makeup:null};changed();showChoices();});
    function showChoices(){
      choices.replaceChildren();
      row.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)));
      if(!effects[category]){
        message.textContent='Les transformations IA sont disponibles après la prise dans IA photo.';choices.hidden=false;
        const ai=document.createElement('button');ai.type='button';ai.textContent='Découvrir les filtres IA';
        ai.addEventListener('click',()=>document.getElementById('cameraAiSide')?.click());choices.appendChild(ai);return;
      }
      choices.hidden=false;message.textContent=status;
      for(const [id,label,glyph] of [[null,'Aucun','∅'],...effects[category]]){
        const button=document.createElement('button');button.type='button';button.className='cameraAppearanceEffect';button.setAttribute('aria-pressed',String(selection[category]===id));
        const thumb=document.createElement('span');thumb.className='cameraAppearanceThumb';thumb.setAttribute('aria-hidden','true');thumb.textContent=glyph;
        const caption=document.createElement('span');caption.textContent=label;button.append(thumb,caption);
        button.addEventListener('click',()=>{selection[category]=id;changed();showChoices();});choices.appendChild(button);
      }
    }
    for(const [id,label] of categories){
      const button=document.createElement('button');button.type='button';button.dataset.category=id;button.textContent=label+(effects[id]||id==='creative-ai'?'':' · bientôt');
      button.addEventListener('click',()=>{category=id;showChoices();modal.dispatchEvent(new CustomEvent('camera-appearance-select',{detail:{category:id,connected:!!effects[id]}}));});row.appendChild(button);
    }
    host.append(row,choices,message,reset);showChoices();
  }
  async function compose(source,output){
    stopLive();const generation=++photoEpoch;
    if(!hasEffects(selection))return output;
    const chosen={...selection};ensureSurfaces();setStatus('Préparation de la photo…');
    try{
      let points;
      if(cache.has(source))points=cache.get(source);
      else{
        // Bound inference resolution, but draw at the original export resolution.
        const input=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(source.width,source.height));
        input.width=Math.max(1,Math.round(source.width*scale));input.height=Math.max(1,Math.round(source.height*scale));
        input.getContext('2d').drawImage(source,0,0,input.width,input.height);
        try{points=await getEngine().detect(input,'IMAGE');}finally{input.width=input.height=0;}
        if(generation!==photoEpoch||!modal.classList.contains('open'))throw new DOMException('Stale photo','AbortError');
        cache.set(source,points);
      }
      const warp=selectedWarp(chosen);
      if(points&&warp){const photoWarp=document.createElement('canvas'),renderer=new FaceWarpRenderer(photoWarp);try{renderer.render(output,points,warp,output.width,output.height);output.getContext('2d').drawImage(photoWarp,0,0);}finally{renderer.close();photoWarp.width=photoWarp.height=0;}}
      drawAppearance(output.getContext('2d'),points,chosen,output.width,output.height);
      setStatus(points?'Effets locaux intégrés à la photo.':'Aucun visage détecté : photo conservée sans Apparence.');
      return output;
    }catch(error){
      if(generation!==photoEpoch||!modal.classList.contains('open')||error.name==='AbortError')throw new DOMException('Stale photo','AbortError');
      failed=true;engine?.close();engine=null;
      setStatus('Suivi indisponible : photo conservée sans Apparence.');return output;
    }
  }
  modal.addEventListener('camera-source-reset',()=>{photoEpoch++;stopLive();cache=new WeakMap();lastVideoTime=-1;});
  modal.addEventListener('camera-stream-ready',()=>schedule());
  modal.addEventListener('camera-framing-change',()=>{stopLive();lastVideoTime=-1;schedule();});
  modal.addEventListener('camera-photo-pending',stopLive);
  modal.addEventListener('camera-closed',()=>{selection={fun:null,glasses:null,accessories:null,makeup:null};release();setStatus('Choisis un effet local.');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLive();else schedule();});
  window.addEventListener('pagehide',release);
  window.addEventListener('pageshow',()=>{
    if(modal.classList.contains('open')&&modal.dataset.cameraState==='processing')modal.dispatchEvent(new Event('camera-appearance-change'));
    else schedule();
  });
  return {renderPanel,compose,setLens,getLens:()=>selection.fun};
}
