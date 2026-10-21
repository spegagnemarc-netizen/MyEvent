/* Private activity covers. Client never holds a service credential. */
(function(root){'use strict';
const MAX=5*1024*1024,TEST='ahyyknfjsielnqyoxqgh';
function testOnly(config){const test=config?.isTest===true&&config.projectRef===TEST;const production=config?.isTest===false&&config.environment==='production'&&config.projectRef==='nxxvadbliinhvkirqkkl';if(!test&&!production)throw Error('Stockage photo indisponible pour cet environnement.');}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;}
async function normalise(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX)throw Error('Choisissez une image JPEG, PNG ou WebP de moins de 5 Mo.');
 let image;if(typeof createImageBitmap==='function'){image=await createImageBitmap(file);}else{const url=URL.createObjectURL(file);try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Cette photo ne peut pas être décodée.'));img.src=url;});image.close=()=>URL.revokeObjectURL(url);}catch(error){URL.revokeObjectURL(url);throw error;}}
 try{if(!image.width||!image.height||image.width*image.height>40000000)throw Error('Image trop grande. Choisissez une photo de résolution inférieure.');
 const ratio=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Conversion de la photo impossible.')),'image/jpeg',.85));if(blob.size>MAX)throw Error('Photo encore trop volumineuse.');return blob;
 }finally{image.close();}
}
async function publish({config,sb,userId,identity,requestId,targetId=null,data,blob,onProgress=()=>{}}){
 testOnly(config);if(!requestId||!userId||identity()!==userId)throw Error('Session modifiée.');if(blob.type!=='image/jpeg'||blob.size<1||blob.size>MAX)throw Error('Photo normalisée invalide.');
 onProgress('Préparation de la photo…');const reservation=await rpc(sb,'activities_cover_begin',{p_request:requestId,p_target:targetId,p_bytes:blob.size});
 if(identity()!==userId)throw Error('Session modifiée.');
 if(!reservation.activity_id){if(reservation.state!=='pending')throw Error('Envoi expiré. Sélectionnez à nouveau votre photo.');onProgress('Envoi de la photo…');
 const upload=await sb.storage.from('activity-media').upload(reservation.path,blob,{upsert:false,contentType:'image/jpeg',cacheControl:'300'});
 // A retry with the same request id may find the completed first upload. Never overwrite it.
 if(upload.error&&!['409','Duplicate'].includes(String(upload.error.statusCode||upload.error.code)))throw upload.error;
 }
 if(identity()!==userId)throw Error('Session modifiée.');onProgress('Enregistrement de la sortie…');
 // Keep requestId after a lost response. Repeating this RPC returns the same activity, not a duplicate.
 const id=await rpc(sb,'activities_save_with_cover',{p_request:requestId,p_target:targetId,p_data:data});onProgress('Activité et photo enregistrées.');return id;
}
async function cancel({config,sb,requestId}){testOnly(config);if(requestId)await rpc(sb,'activities_cover_cancel',{p_request:requestId});}
async function resolveRows({config,sb,rows,userId,identity}){
 testOnly(config);const paths=[...new Set(rows.map(a=>a.cover_path).filter(Boolean))];if(!paths.length)return rows;
 const signed=new Map();for(let offset=0;offset<paths.length;offset+=25){const batch=paths.slice(offset,offset+25);let r=await sb.storage.from('activity-media').createSignedUrls(batch,300);if(identity()!==userId)throw Error('Session modifiée.');if(r.error)r=await sb.storage.from('activity-media').createSignedUrls(batch,300);if(identity()!==userId)throw Error('Session modifiée.');if(!r.error)for(const item of r.data||[])if(item.signedUrl&&!item.error)signed.set(item.path,item.signedUrl);}
 return rows.map(a=>a.cover_path?{...a,cover_url:signed.get(a.cover_path)||root.OrevamiActivitiesCore?.coverURL(a.cover_url)||null}:a);
}
const api=Object.freeze({normalise,publish,cancel,resolveRows});root.OrevamiActivitiesMedia=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

