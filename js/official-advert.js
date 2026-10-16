/* Native Safari controls handle play, pause, sound and fullscreen in this page. */
(() => {
 const video=document.getElementById('myeventOfficialAdvertVideo');
 if(!video)return;
 const status=document.getElementById('myeventOfficialAdvertStatus');
 const pause=()=>video.pause();
 const clearError=()=>{if(status){status.hidden=true;status.textContent='';}};
 video.addEventListener('error',()=>{
  if(!status)return;
  status.textContent='La vidéo ne peut pas être chargée. Vérifiez votre connexion puis actualisez la page.';status.hidden=false;
 });
 video.addEventListener('loadeddata',clearError);
 document.getElementById('myeventDiscoverCard')?.addEventListener('toggle',event=>{if(!event.currentTarget.open)pause();});
 document.getElementById('closeProfileBtn')?.addEventListener('click',pause);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 window.addEventListener('pagehide',pause);
})();
