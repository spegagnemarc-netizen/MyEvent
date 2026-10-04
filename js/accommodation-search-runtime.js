// Keep legacy callers local: Expedia owns destination/date validation and search.
function v58SearchAccommodation(){
  document.getElementById('m58AccommodationSearchBox')?.classList.remove('hidden');
  document.getElementById('m58AccommodationForm')?.classList.add('hidden');
  document.querySelector('#m58AccommodationHotelsWidget iframe')?.focus();
}

(function(window,document){
  'use strict';
  if(window.MyEventAccommodationWidget)return;
  let timer,ready=false;
  function status(){return document.getElementById('m58AccommodationWidgetStatus');}
  function fail(){
    if(ready)return;
    clearTimeout(timer);
    const message=status();
    if(message){message.hidden=false;message.textContent='Le widget Hotels.com n’a pas pu charger. Vérifie ta connexion ou ton bloqueur de contenu, puis réessaie. Tu peux toujours ajouter un hébergement manuellement.';}
    document.getElementById('m58AccommodationWidgetRetry')?.classList.remove('hidden');
  }
  window.MyEventAccommodationWidget={fail};
  function setup(){
    const widget=document.getElementById('m58AccommodationHotelsWidget');
    if(!widget)return;
    document.getElementById('m58AccommodationSearchBtn')?.addEventListener('click',v58SearchAccommodation);
    document.getElementById('m58AccommodationWidgetRetry')?.addEventListener('click',()=>window.location.reload());
    // Only the official iframe's authenticated resize message marks it ready.
    // Do not catch window errors: failures in other MyEvent modules stay visible.
    window.addEventListener('message',event=>{
      const frame=widget.querySelector('iframe');
      if(event.origin!=='https://creator.expediagroup.com'||!frame||event.source!==frame.contentWindow)return;
      if(event.data?.type!=='eg-widget/resize'||event.data.meta?.instance!==widget.getAttribute('data-instance'))return;
      ready=true;clearTimeout(timer);
      if(status())status().hidden=true;
      document.getElementById('m58AccommodationWidgetRetry')?.classList.add('hidden');
    });
    function labelFrame(){
      const frame=widget.querySelector('iframe');
      if(frame)frame.title='Recherche Hotels.com France';
    }
    new MutationObserver(labelFrame).observe(widget,{childList:true});
    labelFrame();
    timer=setTimeout(fail,20000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})(window,document);
