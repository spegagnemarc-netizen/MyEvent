/* Real social posts and event previews; the RPC omits invite codes and private details. */
(() => {
  const $=id=>document.getElementById(id);
  let rows=[],lastUser='';
  const date=value=>value?new Date(value).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'Date à définir';
  async function refresh(){
    const {sb,user}=window.myeventCameraContext?.()||{};
    if(!sb||!user)return;
    const result=await sb.rpc('event_social_feed',{p_limit:30});
    if(result.error){console.warn('Fil événements indisponible:',result.error.message);return;}
    rows=result.data||[];
    $('socialFeed')?.querySelectorAll('[data-event-feed-post]').forEach(node=>node.remove());
    for(const item of rows){
      const post=document.createElement('article');post.className='socialPost';post.dataset.eventFeedPost=item.post_id;
      post.dataset.search=[item.body,item.event_name,item.event_location].filter(Boolean).join(' ').toLowerCase();
      const head=document.createElement('div');head.className='socialPostHead';
      const avatar=document.createElement('div');avatar.className='socialPostAvatar';
      if(item.author_avatar&&/^https:\/\//.test(item.author_avatar)){
        const img=document.createElement('img');img.src=item.author_avatar;img.alt='';avatar.append(img);
      }else avatar.textContent='👤';
      const meta=document.createElement('div');meta.className='socialPostMeta';
      const name=document.createElement('b');name.textContent=item.author_name||'Membre MyEvent';
      const time=document.createElement('span');time.textContent=date(item.created_at)+' · MyEvent';
      meta.append(name,time);head.append(avatar,meta);post.append(head);
      if(item.body){const body=document.createElement('div');body.className='socialPostText';body.textContent=item.body;post.append(body);}
      if(item.event_id){
        const card=document.createElement('div');card.className='socialEventCard';
        const cover=document.createElement('div');cover.className='socialEventCover';
        card.append(cover);
        if(item.event_cover){
          let url=item.event_cover;
          if(!/^https?:\/\//.test(url)){
            const signed=await sb.storage.from('event-media').createSignedUrl(url,300);
            url=signed.error?'':signed.data?.signedUrl||'';
          }
          if(url)cover.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`;
        }
        const info=document.createElement('div');info.className='socialEventInfo';
        const title=document.createElement('div');title.className='socialEventTitle';title.textContent=item.event_name||'Événement';
        const detail=document.createElement('div');detail.className='socialEventMeta';
        detail.textContent='📅 '+date(item.event_date)+(item.event_location?' · 📍 '+item.event_location:'');
        const actions=document.createElement('div');actions.className='socialEventActions';
        const view=document.createElement('button');view.type='button';view.className='secondary socialViewEventBtn';view.dataset.eventId=item.event_id;
        view.textContent='Voir l’événement';actions.append(view);info.append(title,detail,actions);card.append(info);post.append(card);
      }
      $('socialFeed')?.append(post);
    }
    const empty=$('socialFeedEmpty');if(empty)empty.hidden=!!rows.length||!!$('socialFeed')?.querySelector('[data-camera-post-id]');
  }
  window.myeventRefreshSocialFeed=refresh;
  window.myeventViewSocialEvent=async id=>{
    const item=rows.find(row=>row.event_id===id);
    if(!item)return;
    if(item.is_member){try{await window.myeventOpenSocialEvent?.(id)}catch(error){alert(error.message||String(error))}return;}
    let dialog=$('socialEventPreview');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='socialEventPreview';dialog.className='socialEventPreview';
      dialog.innerHTML='<div class="socialEventPreviewBody"><button type="button" class="secondary" data-close>×</button><h2></h2><p data-details></p><p data-description></p><button type="button" data-join>Rejoindre cet événement</button><p data-status role="status"></p></div>';
      document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();}
    dialog.querySelector('h2').textContent=item.event_name||'Événement';
    dialog.querySelector('[data-details]').textContent='📅 '+date(item.event_date)+(item.event_location?' · 📍 '+item.event_location:'');
    dialog.querySelector('[data-description]').textContent='Événement '+(item.visibility==='friends'?'réservé aux amis du créateur':'public')+' partagé par '+item.author_name+'.';
    dialog.querySelector('[data-status]').textContent='';dialog.showModal();
    dialog.querySelector('[data-join]').onclick=async()=>{
      const {sb}=window.myeventCameraContext?.()||{};const button=dialog.querySelector('[data-join]');button.disabled=true;
      try{const joined=await sb.rpc('join_visible_event',{p_event_id:id});if(joined.error)throw joined.error;
        dialog.close();await window.myeventOpenSocialEvent?.(id);await refresh();
      }catch(error){dialog.querySelector('[data-status]').textContent=error.message||String(error)}finally{button.disabled=false;}
    };
  };
  window.addEventListener('load',()=>setTimeout(refresh,800));
  setInterval(()=>{const id=window.myeventCameraContext?.()?.user?.id||'';
    if(id!==lastUser){lastUser=id;rows=[];
      $('socialFeed')?.querySelectorAll('[data-event-feed-post]').forEach(node=>node.remove());
      if($('socialFeedEmpty'))$('socialFeedEmpty').hidden=false;
      refresh();}
  },2000);
})();
