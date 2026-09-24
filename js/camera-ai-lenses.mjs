import {aiLenses} from './camera-ai-presets.mjs';

export function createAILenses(modal){
  let selected='toon',group='Cartoon',controller=null,message='',host=null;
  function cancel(){controller?.abort();controller=null;message='';refresh();}
  function refresh(){
    if(!host?.isConnected||!host.querySelector('.cameraAILenses'))return;
    const busy=!!controller,ready=modal.dataset.cameraState==='preview';
    host.querySelectorAll('.cameraAppearanceCategories button').forEach(b=>{b.disabled=busy;});
    host.querySelectorAll('[data-ai-lens]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(b.dataset.aiLens===selected));});
    host.querySelector('[data-ai-generate]').disabled=busy||!ready;
    host.querySelector('[data-ai-generate]').textContent=busy?'Transformation en cours…':'Transformer ma photo';
    host.querySelector('[data-ai-cancel]').hidden=!busy;
    host.querySelector('[data-ai-original]').disabled=busy||!ready||!modal.cameraHasAIPhoto?.();
    host.querySelector('[role="status"]').textContent=message||(ready?'Choisis ton style, puis transforme ta photo.':'Prends ou importe une photo pour essayer ces filtres IA.');
    host.querySelector('.cameraAILenses').setAttribute('aria-busy',String(busy));
  }
  async function generate(){
    if(controller||modal.dataset.cameraState!=='preview')return;
    const job=new AbortController();controller=job;message='Création de ton nouveau look… Cela peut prendre une à deux minutes.';refresh();
    let timeout;
    try{
      const photo=modal.cameraGetAIPhoto?.();
      if(!photo)throw new Error('Prends ou importe une photo avant de continuer.');
      const {sb}=window.myeventCameraContext?.()||{};
      const session=await sb?.auth.getSession();
      if(controller!==job)return;
      const token=session?.data?.session?.access_token;
      if(!token)throw new Error('Connecte-toi pour utiliser les filtres IA.');
      timeout=setTimeout(()=>job.abort(new DOMException('Timeout','TimeoutError')),165000);
      const response=await fetch('/api/camera-ai',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({lens:selected,imageData:photo.imageData}),signal:job.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'La transformation n’a pas abouti. Réessaie.');
      if(controller!==job)return;
      if(typeof data.image!=='string'||!data.image.startsWith('data:image/webp;base64,'))throw new Error('Image reçue invalide. Ta photo est conservée.');
      // The camera checks the source revision again after decoding the image.
      const applied=await modal.cameraApplyAIPhoto(data.image,photo.revision,job.signal);
      if(controller!==job)return;
      message=applied?'Ton filtre IA est appliqué. Tu peux publier la photo ou l’ajouter à un événement.':'La photo a changé. Relance le filtre sur la nouvelle photo.';
    }catch(error){
      if(controller!==job)return;
      message=error.name==='TimeoutError'?'La transformation a pris trop de temps. Réessaie.':error.message||'Service IA indisponible.';
    }finally{
      clearTimeout(timeout);
      if(controller===job){controller=null;refresh();}
    }
  }
  function render(target){
    host=target;host.replaceChildren();
    const panel=document.createElement('div');panel.className='cameraAILenses';
    const tabs=document.createElement('div');tabs.className='cameraAppearanceCategories';tabs.setAttribute('aria-label','Styles IA');
    for(const name of [...new Set(aiLenses.map(x=>x.group))]){
      const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('aria-pressed',String(group===name));
      button.disabled=!!controller;
      button.addEventListener('click',()=>{group=name;selected=aiLenses.find(x=>x.group===name).id;render(target);});tabs.appendChild(button);
    }
    const choices=document.createElement('div');choices.className='cameraAppearanceEffects';
    for(const lens of aiLenses.filter(x=>x.group===group)){
      const button=document.createElement('button');button.type='button';button.className='cameraAppearanceEffect';button.dataset.aiLens=lens.id;
      const icon=document.createElement('span');icon.className='cameraAppearanceThumb';icon.textContent=lens.icon;icon.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=lens.label;button.append(icon,label);
      button.addEventListener('click',()=>{selected=lens.id;message='';refresh();});choices.appendChild(button);
    }
    const note=document.createElement('p');note.textContent='Après la prise : ta photo est envoyée à OpenAI uniquement lorsque tu appuies sur « Transformer ». Chaque transformation utilise le service IA payant de MyEvent.';
    const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const actions=document.createElement('div');actions.className='cameraPanelChoices';
    const generateButton=document.createElement('button');generateButton.type='button';generateButton.dataset.aiGenerate='';generateButton.addEventListener('click',generate);
    const original=document.createElement('button');original.type='button';original.dataset.aiOriginal='';original.textContent='Revenir à l’original';original.addEventListener('click',()=>{modal.cameraRestoreAIPhoto?.();message='Photo d’origine restaurée.';refresh();});
    const stop=document.createElement('button');stop.type='button';stop.dataset.aiCancel='';stop.textContent='Annuler';stop.addEventListener('click',()=>{cancel();message='Annulé. Ta photo est conservée.';refresh();});
    actions.append(generateButton,original,stop);panel.append(tabs,choices,note,status,actions);host.appendChild(panel);refresh();
  }
  modal.addEventListener('camera-source-reset',cancel);
  modal.addEventListener('camera-closed',cancel);
  modal.addEventListener('camera-preview-ready',refresh);
  modal.addEventListener('camera-photo-pending',refresh);
  window.addEventListener('pagehide',cancel);
  return {render};
}
