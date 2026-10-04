// Legacy search stays local; the official widgets own search and validation.
function v58SearchAccommodation(){
  document.getElementById('m58AccommodationSearchBox')?.classList.remove('hidden');
  document.getElementById('m58AccommodationForm')?.classList.add('hidden');
  document.querySelector('#m58AccommodationSearchBox .myeventEgSlot:not([hidden]) iframe')?.focus();
}
(function(window,document){
  'use strict';
  if(window.MyEventAccommodationWidget)return;
  const states=new Map();let scriptFailed=false;
  function failed(state){
    if(state.ready)return;
    clearTimeout(state.timer);
    state.status.hidden=false;
    state.status.textContent='Le widget '+state.name+' n’a pas pu charger. Vérifie ta connexion ou ton bloqueur de contenu, puis réessaie. Les autres partenaires et l’ajout manuel restent disponibles.';
    state.retry.hidden=false;
  }
  function fail(){scriptFailed=true;states.forEach(failed);}
  window.MyEventAccommodationWidget={fail};
  function setup(){
    document.getElementById('m58AccommodationSearchBtn')?.addEventListener('click',v58SearchAccommodation);
    document.querySelectorAll('[data-partner-select]').forEach(button=>{
      button.addEventListener('click',()=>{
        const group=button.closest('.myeventPartnerSelector');
        group.querySelectorAll('[data-partner-select]').forEach(choice=>{
          const selected=choice===button;
          choice.setAttribute('aria-pressed',String(selected));
          document.getElementById(choice.dataset.partnerSelect).hidden=!selected;
        });
      });
    });
    document.querySelectorAll('.myeventEgSlot').forEach(slot=>{
      const widget=slot.querySelector('.eg-widget');
      const state={widget,name:slot.dataset.partner,status:slot.querySelector('.myeventEgStatus'),retry:slot.querySelector('.myeventEgRetry'),ready:false};
      states.set(widget,state);
      state.retry.addEventListener('click',()=>window.location.reload());
      function labelFrame(){const frame=widget.querySelector('iframe');if(frame)frame.title='Recherche '+state.name+' France';}
      new MutationObserver(labelFrame).observe(widget,{childList:true});labelFrame();
      state.timer=setTimeout(()=>failed(state),20000);
      if(scriptFailed)failed(state);
    });
    window.addEventListener('message',event=>{
      if(event.origin!=='https://creator.expediagroup.com'||event.data?.type!=='eg-widget/resize')return;
      states.forEach(state=>{
        const frame=state.widget.querySelector('iframe');
        if(!frame||event.source!==frame.contentWindow||event.data.meta?.instance!==state.widget.getAttribute('data-instance'))return;
        state.ready=true;clearTimeout(state.timer);state.status.hidden=true;state.retry.hidden=true;
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})(window,document);
