/* Account-scoped hydration; uses the existing authenticated client and its RLS. */
(()=>{
 window.createCameraFeedRefresh=({context,load,render})=>{
  let account='',revision=0;
  const feed=document.getElementById('socialFeed'),empty=document.getElementById('socialFeedEmpty');
  const status=document.createElement('p');status.id='cameraFeedStatus';status.setAttribute('role','status');
  const retry=document.createElement('button');retry.type='button';retry.textContent='Réessayer';retry.hidden=true;
  feed?.before(status,retry);
  const clear=()=>feed?.querySelectorAll('[data-camera-post-id]').forEach(post=>post.remove());
  const reconcile=()=>{if(empty)empty.hidden=!!feed?.querySelector('[data-camera-post-id],[data-event-feed-post]')||['loading','error'].includes(status.dataset.state);};
  async function refresh(){
   const id=context()?.user?.id||'',ticket=++revision;
   if(id!==account){clear();account=id;}
   retry.hidden=true;status.dataset.state=id?'loading':'ready';status.textContent=id?'Chargement des publications…':'';reconcile();
   if(!id)return;
   try{
    const rows=await load();
    if(ticket!==revision||context()?.user?.id!==id)return;
    clear();rows.slice().reverse().forEach(render);status.dataset.state='ready';status.textContent='';
   }catch(error){
    if(ticket!==revision||context()?.user?.id!==id)return;
    status.dataset.state='error';status.textContent='Impossible de charger les photos. Réessaie.';retry.hidden=false;
    console.warn('Fil caméra indisponible:',error?.message||error);
   }
   reconcile();
  }
  retry.onclick=refresh;
  const timer=setInterval(()=>{if((context()?.user?.id||'')!==account)void refresh();},1000);
  void refresh();
  return {refresh,stop(){clearInterval(timer);revision++;}};
 };
})();
