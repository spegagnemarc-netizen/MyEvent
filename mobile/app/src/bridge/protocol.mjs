export const MAX_PHOTO_BYTES = 4*1024*1024;
export function trustedNavigation(raw, origin) {
  try { const url=new URL(raw); return url.protocol==='https:' && url.origin===origin && !url.username && !url.password; } catch { return false; }
}
export function validatePhoto(base64) {
  if(typeof base64!=='string' || base64.length>Math.ceil(MAX_PHOTO_BYTES/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('Photo trop volumineuse ou invalide.');
  const binary=atob(base64);
  if(binary.length<4 || binary.length>MAX_PHOTO_BYTES || binary.charCodeAt(0)!==255 || binary.charCodeAt(1)!==216 || binary.charCodeAt(binary.length-2)!==255 || binary.charCodeAt(binary.length-1)!==217)throw new Error('JPEG invalide.');
}
export function importPhotoScript(base64, origin, id) {
  validatePhoto(base64);
  // Serialized arguments; never concatenate an unescaped URI, caption or session token.
  const payload=JSON.stringify({base64,origin,id});
  return `(function(){
    const p=${payload};
    if(window!==window.top || location.origin!==p.origin)return;
    function reply(type){window.ReactNativeWebView?.postMessage(JSON.stringify({version:1,type,id:p.id}));}
    const input=document.getElementById('cameraFileInput'),open=document.getElementById('socialBottomCreate');
    if(!input || !open || typeof DataTransfer!=='function'){reply('import-unavailable');return;}
    try{
      open.click();
      const bytes=Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0));
      const transfer=new DataTransfer();transfer.items.add(new File([bytes],'MyEvent-mobile.jpg',{type:'image/jpeg'}));
      input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));reply('imported');
    }catch(_){reply('import-unavailable');}
  })();true;`;
}
