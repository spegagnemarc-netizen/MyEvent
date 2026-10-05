import {importPhotoScript} from './protocol.mjs';

// Use the existing authenticated handlers, including the Story capture-phase handler.
// No storage client, credential or independent persistence implementation lives here.
export function photoActionScript(base64,origin,id,action){
  if(!['publish','event'].includes(action))throw Error('Action inconnue');
  const imported=importPhotoScript(base64,origin,id,true);
  const payload=JSON.stringify({origin,id,action});
  return `(function(){
    const p=${payload};
    if(window!==window.top || location.origin!==p.origin)return;
    const jobs=window.__myeventPhotoActions||(window.__myeventPhotoActions=new Map());
    function reply(type,error){window.ReactNativeWebView?.postMessage(JSON.stringify({version:1,id:p.id,type,error}));}
    if(jobs.has(p.id)){const previous=jobs.get(p.id);if(previous.type)reply(previous.type,previous.error);return;}
    const modal=document.getElementById('myeventCameraModal'),button=document.getElementById(p.action==='publish'?'cameraPublishBtn':'cameraEventBtn');
    const note=document.getElementById('cameraPlaceholder');
    if(!modal || !button || !document.getElementById('cameraFileInput')){reply('action-failed','Accueil caméra indisponible.');return;}
    if(p.action==='event'&&!document.querySelector('#eventList .eventCard')){reply('action-failed','Aucun événement affiché : chargez ou créez un événement puis réessayez.');return;}
    jobs.set(p.id,{});
    const display=modal.style.display,originalAlert=window.alert;
    let finished=false,started=false,timer,observer;
    modal.style.setProperty('display','none','important');
    function finish(type,error){
      if(finished)return;finished=true;clearTimeout(timer);observer?.disconnect();
      modal.removeEventListener('camera-preview-ready',ready);modal.removeEventListener('camera-closed',closed);
      window.alert=originalAlert;
      if(type==='action-failed')document.getElementById('cameraCloseBtn')?.click();
      modal.style.display=display;
      if(type==='action-completed')window.__myeventMobileCamera?.release();
      jobs.set(p.id,{type,error});reply(type,error);
      if(type==='action-failed')jobs.delete(p.id);
    }
    function closed(){if(started)finish('action-completed');}
    function ready(){
      if(started || finished)return;started=true;clearTimeout(timer);
      // Persistence completion is signalled by the existing handler closing the modal.
      window.alert=message=>{if(String(message).startsWith('Story impossible'))finish('action-failed',String(message));else originalAlert.call(window,message);};
      button.click();
    }
    modal.addEventListener('camera-preview-ready',ready);
    modal.addEventListener('camera-closed',closed);
    observer=new MutationObserver(()=>{const text=note?.textContent||'';if(/^(Publication impossible|Impossible de préparer|Impossible d’importer|Format de photo)/.test(text))finish('action-failed',text);});
    if(note)observer.observe(note,{childList:true,subtree:true,characterData:true});
    timer=setTimeout(()=>finish('action-failed','Préparation de la photo trop longue.'),10000);
    if(window.__myeventMobileCamera?.story)document.getElementById('storyUseCamera')?.click();
    ${imported}
  })();true;`;
}
