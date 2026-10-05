// Injected by React Native only. No deployed web file is changed.
export function cameraTriggerScript(origin, token) {
  return `(function(){
    const origin=${JSON.stringify(origin)},token=${JSON.stringify(token)};
    if(window!==window.top || location.origin!==origin || !window.ReactNativeWebView?.postMessage)return;
    const key='__myeventMobileCamera';
    window[key]?.dispose();
    let bypass=false,opening=false,available;
    function send(type,extra={}){window.ReactNativeWebView.postMessage(JSON.stringify({version:1,type,token,...extra}));}
    function announce(){
      const exists=!!document.getElementById('socialBottomCreate');
      if(exists!==available){available=exists;send('camera-trigger-ready',{available:exists});}
    }
    function click(event){
      if(bypass || !event.target?.closest?.('#socialBottomCreate'))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(opening)return;
      opening=true;
      try{send('open-native-camera');}catch(_){opening=false;openWeb();}
    }
    function openWeb(){
      opening=false;bypass=true;
      try{document.getElementById('socialBottomCreate')?.click();}finally{bypass=false;}
    }
    const observer=new MutationObserver(announce);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('click',click,true);
    window[key]={openWeb,release(){opening=false;},dispose(){observer.disconnect();window.removeEventListener('click',click,true);}};
    announce();
  })();true;`;
}
export function cameraTriggerMessage(raw, url, origin, token) {
  let message;
  try{const parsed=new URL(url);if(parsed.protocol!=='https:' || parsed.origin!==origin || parsed.username || parsed.password)return null;
    if(typeof raw!=='string' || raw.length>1000)return null;message=JSON.parse(raw);
  }catch{return null;}
  if(!message || message.version!==1 || message.token!==token)return null;
  if(message.type==='camera-trigger-ready' && typeof message.available==='boolean')return message;
  if(message.type==='open-native-camera')return message;
  return null;
}
export function openWebCameraScript(origin) {
  return `if(location.origin===${JSON.stringify(origin)}){if(window.__myeventMobileCamera)window.__myeventMobileCamera.openWeb();else document.getElementById('socialBottomCreate')?.click();}true;`;
}
export function releaseCameraTriggerScript(origin) {
  return `if(location.origin===${JSON.stringify(origin)}){window.__myeventMobileCamera?.release();document.getElementById('myeventCameraModal')?.dispatchEvent(new Event('camera-closed'));}true;`;
}
