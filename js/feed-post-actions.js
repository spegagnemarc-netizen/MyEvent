/* Feed-only deletion. The server authenticates every request and checks DB permissions. */
(() => {
 'use strict';
 const feed=document.getElementById('socialFeed');if(!feed)return;
 const context=()=>window.myeventCameraContext?.()||{};
 const target=post=>post?.dataset.cameraPostId?{kind:'camera',id:post.dataset.cameraPostId}:post?.dataset.eventFeedPost?{kind:'event',id:post.dataset.eventFeedPost}:null;
 let owner='',admin=false,epoch=0,permissionRequest=null;
 const deleted=new Set();
 const errorText=error=>['TimeoutError','AbortError','TypeError'].includes(error?.name)?'Connexion interrompue. Actualise le fil pour vérifier la suppression avant de réessayer.':error?.message||'Suppression impossible. Réessaie.';
 function notice(message,retry){
  let box=document.getElementById('socialFeedDeleteStatus');
  if(!box){box=document.createElement('p');box.id='socialFeedDeleteStatus';box.setAttribute('role','status');feed.before(box);}
  box.replaceChildren(document.createTextNode(message));
  if(retry){const button=document.createElement('button');button.type='button';button.textContent='Réessayer le nettoyage';button.onclick=retry;box.append(button);}
 }
 function sync(){
  const id=context().user?.id||'';
  if(id!==owner){owner=id;admin=false;epoch++;permissionRequest=null;deleted.clear();document.getElementById('socialFeedDeleteStatus')?.remove();feed.querySelectorAll('.socialPostMenu').forEach(x=>x.remove());}
  return id;
 }
 function decorate(){
  sync();
  feed.querySelectorAll('.socialPost').forEach(post=>{
   const item=target(post);if(!item)return;
   if(deleted.has(item.kind+':'+item.id)){post.remove();return;}
   const allowed=owner&&(post.dataset.authorId===owner||admin);
   const existing=post.querySelector('.socialPostMenu');
   if(!allowed){existing?.remove();return;}
   if(existing)return;
   const head=post.querySelector('.socialPostHead');if(!head)return;
   const menu=document.createElement('details');menu.className='socialPostMenu';
   const toggle=document.createElement('summary');toggle.textContent='⋯';toggle.setAttribute('aria-label','Options de la publication');
   const button=document.createElement('button');button.type='button';button.textContent='Supprimer la publication';button.className='socialPostDelete';
   button.onclick=()=>remove(post,item,button);
   menu.append(toggle,button);head.append(menu);
  });
 }
 async function permissions(){
  sync();const {sb,user}=context();if(!user||!sb||permissionRequest)return;
  const revision=epoch;
  permissionRequest=(async()=>{
   try{const {data,error}=await sb.rpc('myevent_admin_identity');if(revision!==epoch||context().user?.id!==user.id)return;
    admin=!error&&data?.user_id===user.id&&data?.account_active===true&&data?.is_admin===true&&data?.role==='super_admin';
   }catch{if(revision===epoch)admin=false;}
   if(revision===epoch)decorate();
  })();
 }
 async function send(item,account,cleanupReceipt){
  const {sb,user}=context();if(!sb||user?.id!==account)throw Error('Compte changé. Reconnecte-toi avant de réessayer.');
  const session=await sb.auth.getSession();
  if(session.error||session.data?.session?.user?.id!==account||!session.data.session.access_token||context().user?.id!==account)throw Error('Session expirée. Reconnecte-toi.');
  const response=await fetch('/api/feed-post-deletion',{method:'POST',headers:{Authorization:'Bearer '+session.data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({...item,...(cleanupReceipt?{cleanupReceipt}:{})}),signal:AbortSignal.timeout(60000)});
  const data=await response.json();
  if(!response.ok||data.deleted!==true)throw Error(data.error||'Suppression non confirmée. Actualise le fil.');
  return data;
 }
 function resultNotice(data,item,account){
  if(context().user?.id!==account)return;
  notice(data.cleanupPending?(data.error||'Publication supprimée. Nettoyage du média en attente.'):'Publication supprimée.',data.cleanupPending&&data.cleanupReceipt?async()=>{
   notice('Nettoyage du média…');
   try{resultNotice(await send(item,account,data.cleanupReceipt),item,account);}catch(error){if(context().user?.id===account)notice(errorText(error));}
  }:null);
 }
 async function remove(post,item,button){
  if(button.disabled)return;
  if(!window.confirm('Supprimer définitivement cette publication et ses médias non partagés ? Cette action est irréversible.'))return;
  const account=sync();if(!account)return;
  button.disabled=true;
  try{
   const data=await send(item,account);
   if(context().user?.id!==account)return;
   deleted.add(item.kind+':'+item.id);post.remove();
   const empty=document.getElementById('socialFeedEmpty');if(empty)empty.hidden=!!feed.querySelector('[data-camera-post-id],[data-event-feed-post]');
   resultNotice(data,item,account);
  }catch(error){if(context().user?.id===account)notice(errorText(error));}
  finally{button.disabled=false;}
 }
 new MutationObserver(decorate).observe(feed,{childList:true,subtree:true});
 window.addEventListener('myevent-camera-feed-session',()=>{decorate();permissions();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){permissionRequest=null;permissions();}});
 decorate();permissions();
})();
