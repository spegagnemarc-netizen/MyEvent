/* Native gallery picker; TEST media uploads retain existing private ownership rules. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),panel=$('socialComposerPanel'),publish=$('socialPublishBtn'),message=$('socialPostMsg'),text=$('socialPostText'),preview=$('socialComposerMediaPreview');
 if(!panel||!publish)return;
 const context=()=>window.myeventCameraContext?.()||{};
 let selected=null,previewUrl='',busy=false,preparing=false,revision=0,mediaEnabled=false;
 const publishedUrls=new Set();
 function notice(value){message.textContent=value;}
 function revokePreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';preview.querySelector('video')?.pause();preview.replaceChildren();preview.hidden=true;}
 function clear(){revision++;selected=null;preparing=false;revokePreview();for(const id of ['socialPhotoInput','socialVideoInput'])$(id).value='';}
 function controls(){for(const id of ['socialAddPhoto','socialAddVideo','socialRemoveMedia','socialCancelPostBtn'])if($(id))$(id).disabled=busy;publish.disabled=busy||preparing;publish.textContent=busy?'Publication…':'🚀 Publier';}
 async function jpeg(file){
   const url=URL.createObjectURL(file),image=new Image();
   try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
     const ratio=Math.min(1,4096/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
     const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)throw Error('IMAGE_DECODE');return blob;
   }finally{URL.revokeObjectURL(url);}
 }
 async function select(file,kind){
   if(!file||busy)return;
   clear();const ticket=revision;preparing=true;controls();notice('Préparation du média…');
   try{
     if(!file.size||file.size>15728640)throw Error('MEDIA_SIZE');
     const type=file.type.split(';')[0];
     if(kind==='image'&&!type.startsWith('image/'))throw Error('MEDIA_FORMAT');
     if(kind==='video'&&!['video/mp4','video/quicktime','video/webm'].includes(type))throw Error('MEDIA_FORMAT');
     const blob=kind==='image'?await jpeg(file):file;
     if(ticket!==revision)return;
     if(!blob.size||blob.size>15728640)throw Error('MEDIA_SIZE');
     selected=blob;previewUrl=URL.createObjectURL(blob);
     const media=document.createElement(kind==='image'?'img':'video');media.src=previewUrl;
     if(kind==='image')media.alt='Aperçu avant publication';else{media.controls=true;media.playsInline=true;media.preload='metadata';}
     media.addEventListener('error',()=>{if(ticket===revision)notice('Aperçu illisible dans Safari. Choisis un fichier compatible, par exemple une vidéo MP4 H.264.');});
     const remove=document.createElement('button');remove.type='button';remove.id='socialRemoveMedia';remove.className='secondary';remove.textContent='Retirer le média';remove.onclick=()=>{clear();controls();notice('Média retiré.');};
     preview.append(media,remove);preview.hidden=false;notice('Média prêt. Tu peux ajouter un texte puis publier.');
   }catch(error){if(ticket===revision){clear();notice(error.message==='MEDIA_SIZE'?'Le média doit être non vide et ne pas dépasser 15 Mo.':'Ce média ne peut pas être préparé. Choisis une photo lisible par Safari ou une vidéo MP4, MOV ou WebM.');}}
   finally{if(ticket===revision)preparing=false;controls();}
 }
 for(const [button,input,kind] of [['socialAddPhoto','socialPhotoInput','image'],['socialAddVideo','socialVideoInput','video']]){
   $(button)?.addEventListener('click',()=>{if(!busy&&mediaEnabled)$(input).click();});
   $(input)?.addEventListener('change',()=>select($(input).files?.[0],kind));
 }
 $('socialCancelPostBtn')?.addEventListener('click',()=>{if(busy)return;clear();text.value='';panel.classList.remove('open');notice('');controls();});
 publish.addEventListener('click',async()=>{
   if(busy||preparing)return;
   const {sb,user}=context(),owner=user?.id,body=text.value.trim(),media=selected;
   if(!owner||!sb){notice('Connecte-toi pour publier.');return;}
   if(!body&&!media){notice('Écris un texte ou ajoute un média avant de publier.');return;}
   const ticket=revision;busy=true;controls();notice(media?'Envoi du média…':'Enregistrement de la publication…');
   try{
     if(media){
       const saved=await window.myeventPublishFeedMedia(media,body,stage=>{if(owner===context().user?.id&&ticket===revision)notice(stage==='stockage'?'Envoi du média…':'Enregistrement de la publication…');});
       if(owner!==context().user?.id||ticket!==revision)return;
       const url=URL.createObjectURL(media);publishedUrls.add(url);
       try{window.myeventRenderCameraFeedPost({...saved,image:url},true);}catch{notice('Publication enregistrée. Actualise le fil pour la retrouver.');return;}
     }else{
       const result=await sb.from('event_feed_posts').insert({author_id:owner,body});if(result.error)throw result.error;
       if(owner!==context().user?.id||ticket!==revision)return;
       try{await window.myeventRefreshSocialFeed?.();}catch{/* Persisted text must not be reported as a failed insert. */}
     }
     if(owner!==context().user?.id||ticket!==revision)return;
     clear();text.value='';panel.classList.remove('open');notice('');$('socialFeedPublishStatus').textContent='Publication enregistrée dans le fil.';
   }catch(error){
     if(owner!==context().user?.id||ticket!==revision)return;
     const code=String(error?.code||error?.statusCode||'');
     notice(code==='42501'?'Publication refusée par les permissions TEST. Ton contenu est conservé.':error.message==='MEDIA_INVALID'?'Format non pris en charge ou média supérieur à 15 Mo.':error.message==='SESSION_CHANGED'||error.message==='SESSION_REQUIRED'?'Session interrompue. Reconnecte-toi avant de publier.':'Publication impossible. Vérifie ta connexion et réessaie. Ton contenu est conservé.');
   }finally{busy=false;controls();}
 });
 window.addEventListener('myevent-camera-feed-session',()=>{clear();text.value='';notice('');panel.classList.remove('open');for(const url of publishedUrls)URL.revokeObjectURL(url);publishedUrls.clear();controls();});
 window.myeventRuntime?.ready.then(config=>{mediaEnabled=config.environment==='preview'&&config.isTest===true&&config.projectRef==='ahyyknfjsielnqyoxqgh';$('socialComposerMediaTools').hidden=!mediaEnabled;}).catch(()=>{});
})();
