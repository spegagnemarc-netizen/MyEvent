/* Persistent reactions for the two existing social feed post types. */
(() => {
  const context=()=>window.myeventCameraContext?.()||{};
  const identity=post=>post?.dataset.eventFeedPost?{kind:'event',id:post.dataset.eventFeedPost,column:'event_post_id'}:
    post?.dataset.cameraPostId?{kind:'camera',id:post.dataset.cameraPostId,column:'camera_post_id'}:null;
  let account=null,client=null,channel=null,refreshTimer=null;
  function status(post,message){const el=post?.querySelector('.socialReactionStatus');if(el)el.textContent=message;}
  async function refresh(post){const target=identity(post),{sb,user}=context();if(!target||!sb||!user)return;
    try{const result=await sb.rpc('feed_interactions',{p_kind:target.kind,p_post:target.id});if(result.error)throw result.error;
      if(!post.isConnected||context().user?.id!==user.id)return;
      const like=post.querySelector('.socialLikeBtn');like.classList.toggle('active',result.data.liked);
      like.setAttribute('aria-pressed',String(result.data.liked));like.firstChild.textContent=result.data.liked?'♥ J’aime ':'♡ J’aime ';
      like.querySelector('span').textContent=result.data.likes;
      const list=post.querySelector('.socialCommentList');list.replaceChildren();
      for(const row of result.data.comments){const entry=document.createElement('div');entry.className='socialCommentItem';
        const avatar=document.createElement('span');avatar.className='socialCommentAvatar';
        if(row.author_avatar&&/^https:\/\//.test(row.author_avatar)){const image=document.createElement('img');image.src=row.author_avatar;image.alt='';avatar.append(image);}
        else avatar.textContent='👤';
        const detail=document.createElement('span'),name=document.createElement('b'),time=document.createElement('time'),body=document.createElement('span');
        name.textContent=row.author_name;time.textContent=new Date(row.created_at).toLocaleString('fr-FR');body.textContent=row.body;
        detail.append(name,time,body);entry.append(avatar,detail);
        if(row.author_id===user.id){const del=document.createElement('button');del.type='button';del.className='socialCommentDelete';del.textContent='×';del.setAttribute('aria-label','Supprimer mon commentaire');del.dataset.commentId=row.id;entry.append(del);}
        list.append(entry);
      }
      status(post,'');
    }catch(error){status(post,'Interactions indisponibles : '+(error.message||String(error)));}
  }
  function attach(post){if(!identity(post)||post.querySelector('.socialReactionStatus'))return;
    let actions=post.querySelector('.socialActions');if(!actions){actions=document.createElement('div');actions.className='socialActions';post.append(actions);}
    if(!actions.querySelector('.socialLikeBtn'))actions.insertAdjacentHTML('afterbegin','<button type="button" class="socialLikeBtn" aria-pressed="false">♡ J’aime <span>0</span></button>');
    if(!actions.querySelector('.socialCommentBtn'))actions.insertAdjacentHTML('beforeend','<button type="button" class="socialCommentBtn">💬 Commenter</button>');
    let box=post.querySelector('.socialCommentBox');if(!box){box=document.createElement('div');box.className='socialCommentBox';box.innerHTML='<input maxlength="1000" placeholder="Écrire un commentaire…" aria-label="Écrire un commentaire"><button type="button">Envoyer</button>';post.append(box);}
    box.querySelector('input').maxLength=1000;
    const list=document.createElement('div');list.className='socialCommentList';box.prepend(list);
    const message=document.createElement('p');message.className='socialReactionStatus';message.setAttribute('role','status');box.append(message);
    refresh(post);
  }
  async function mutate(post,action,button){const target=identity(post),{sb,user}=context();if(!target||!sb||!user)return;
    button.disabled=true;status(post,'');
    try{let result;
      if(action==='like')result=button.classList.contains('active')?
        await sb.from('feed_likes').delete().eq(target.column,target.id).eq('user_id',user.id):
        await sb.from('feed_likes').insert({[target.column]:target.id,user_id:user.id});
      if(action==='send'){const input=post.querySelector('.socialCommentBox input'),body=input.value.trim();if(!body)return;
        result=await sb.from('feed_comments').insert({[target.column]:target.id,author_id:user.id,body});if(!result.error)input.value='';}
      if(action==='delete')result=await sb.from('feed_comments').delete().eq('id',button.dataset.commentId).eq('author_id',user.id);
      if(result.error)throw result.error;await refresh(post);
    }catch(error){status(post,'Action impossible : '+(error.message||String(error)));}finally{button.disabled=false;}
  }
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{
    document.querySelectorAll('#socialFeed .socialPost').forEach(post=>{if(identity(post))refresh(post);});
  },250);}
  function sync(){const {sb,user}=context(),id=user?.id||null;if(id===account&&sb===client)return;
    if(channel&&client)client.removeChannel(channel);account=id;client=sb;channel=null;
    if(id&&sb)channel=sb.channel('feed-reactions-'+id)
      .on('postgres_changes',{event:'*',schema:'public',table:'feed_likes'},schedule)
      .on('postgres_changes',{event:'*',schema:'public',table:'feed_comments'},schedule).subscribe();
    schedule();
  }
  window.myeventFeedInteractions={attach,mutate,refresh};
  setInterval(sync,2000);sync();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
})();
