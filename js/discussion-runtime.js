/* ===== original inline script 5 ===== */
// V45 — préférences Discussion privées par utilisateur/événement. Les images personnalisées restent locales pour éviter tout blocage du compte.
// V17 — l'overlay existe maintenant dans le DOM : initialisation après son rendu.
(function initChatCustomizationV17(){
  const panel=document.getElementById('discussionContent');
  const overlay=document.getElementById('chatCustomizeOverlay');
  const openBtn=document.getElementById('chatCustomizeBtn');
  const closeBtn=document.getElementById('chatCustomizeClose');
  const doneBtn=document.getElementById('chatCustomizeDone');
  const resetBtn=document.getElementById('chatCustomizeReset');
  const saveBtn=document.getElementById('chatCustomizeSave');
  if(!panel||!overlay||!openBtn)return;
  const key=()=>`myevent-chat-style-${user?.id||'guest'}-${event?.id||'default'}`;
  const globalKey=()=>`myevent-chat-style-user-${user?.id||'guest'}`;
  const defaults={bg:'mountain',bubble:'modern',color:'#1683ff',incomingColor:'#142b3d',opacity:62,customBg:''};
  let style={...defaults};
  const readStyle=(raw)=>{
    try{ const x=typeof raw==='string'?(raw?JSON.parse(raw):null):raw; return x&&typeof x==='object'?{...defaults,...x}:null; }catch{return null;}
  };
  const readServerStyles=()=>{
    const raw=user?.user_metadata?.myevent_chat_styles_v2;
    if(!raw||typeof raw!=='object')return null;
    return raw;
  };
  const load=async()=>{
    try{
      if(!user?.id||!event?.id)return;
      if(sb?.auth){
        const r=await sb.auth.getUser();
        if(!r.error&&r.data?.user)user=r.data.user;
      }
      // Les réglages légers sont synchronisés sur le compte. L'image personnalisée
      // reste locale : on ne met JAMAIS une data:image volumineuse dans user_metadata.
      const local=readStyle(localStorage.getItem(key()));
      const styles=readServerStyles();
      const serverStyle=styles ? readStyle(styles[event.id]) : null;
      if(serverStyle){
        style={...defaults,...serverStyle,...(local?.customBg?{customBg:local.customBg}:{})};
        try{localStorage.setItem(key(),JSON.stringify(style));}catch{}
        return;
      }
      const legacy=readStyle(user?.user_metadata?.myevent_chat_style);
      if(legacy){
        style={...defaults,...legacy,...(local?.customBg?{customBg:local.customBg}:{})};
        try{localStorage.setItem(key(),JSON.stringify(style));}catch{}
        return;
      }
      if(local)style={...defaults,...local};
      else style={...defaults};
    }catch(e){ console.warn('Chargement personnalisation:',e?.message||e); }
  };
  let saveQueue=Promise.resolve();
  let saveBusy=false;
  const saveNow=async()=>{
    if(!user?.id||!event?.id)return false;
    try{
      const payloadObj={...style,savedAt:Date.now()};
      // Toujours conserver la copie locale complète, y compris une éventuelle image.
      localStorage.setItem(key(),JSON.stringify(payloadObj));
      localStorage.setItem(globalKey(),JSON.stringify(payloadObj));
      if(sb?.auth){
        const ses=await sb.auth.getSession();
        if(!ses?.data?.session?.access_token)throw new Error('Session Supabase absente ou expirée.');
        const fresh=await sb.auth.getUser();
        if(fresh.error)throw fresh.error;
        if(fresh.data?.user)user=fresh.data.user;
        const current=(user.user_metadata?.myevent_chat_styles_v2&&typeof user.user_metadata.myevent_chat_styles_v2==='object')
          ? {...user.user_metadata.myevent_chat_styles_v2}:{};
        // IMPORTANT : aucune image/base64 dans user_metadata.
        const serverPayload={
          bg:payloadObj.bg,
          bubble:payloadObj.bubble,
          color:payloadObj.color,
          incomingColor:payloadObj.incomingColor,
          opacity:payloadObj.opacity,
          savedAt:payloadObj.savedAt
        };
        current[event.id]=serverPayload;
        const r=await sb.auth.updateUser({data:{myevent_chat_styles_v2:current,myevent_chat_style:null}});
        if(r.error)throw r.error;
        if(r.data?.user)user=r.data.user;
        const verify=await sb.auth.getUser();
        if(verify.error)throw verify.error;
        const verified=verify.data?.user?.user_metadata?.myevent_chat_styles_v2?.[event.id];
        if(!verified||Number(verified.savedAt)!==Number(serverPayload.savedAt))throw new Error('Supabase n’a pas confirmé la sauvegarde du réglage.');
      }
      const status=document.getElementById('chatCustomizeSaveStatus');
      if(status){status.textContent='✓ Sauvegardé sur mon compte';status.classList.remove('hidden');setTimeout(()=>status.classList.add('hidden'),2200);}
      return true;
    }catch(e){
      console.warn('Sauvegarde personnalisation:',e?.message||e);
      const status=document.getElementById('chatCustomizeSaveStatus');
      if(status){status.textContent='⚠️ Réglage local conservé';status.classList.remove('hidden');setTimeout(()=>status.classList.add('hidden'),3200);}
      return false;
    }
  };
  const save=()=>{saveQueue=saveQueue.then(()=>saveNow());return saveQueue;};
  function apply(){
    // Utilise exactement les mêmes visuels que les vignettes du sélecteur.
    // Les anciennes versions remplaçaient les décors par de simples dégradés,
    // ce qui donnait par exemple une Aurore bleu/verte sans paysage.
    const bgClassMap={mountain:'bg-mountain',beach:'bg-beach',forest:'bg-forest',city:'bg-city',night:'bg-night',sunset:'bg-sunset',aurora:'bg-aurora',space:'bg-space',winter:'bg-winter',dream:'bg-dream',tropical:'bg-tropical',lagoon:'bg-lagoon'};
    // Les vignettes et le fond utilisent les mêmes classes CSS : aucune substitution en dégradé.
    let bgImage='none';
    if(style.customBg){
      bgImage=`url("${style.customBg.replace(/"/g,'%22')}")`;
    }else{
      const probe=document.createElement('div');
      probe.className='chatBgPreview '+(bgClassMap[style.bg]||'bg-lake');
      probe.style.position='absolute'; probe.style.width='1px'; probe.style.height='1px'; probe.style.pointerEvents='none';
      document.body.appendChild(probe);
      bgImage=getComputedStyle(probe).backgroundImage || 'none';
      probe.remove();
    }
    panel.style.setProperty('--chat-bg-image',bgImage);
    panel.style.setProperty('--bubble-out',style.color);
    const alpha=Math.max(0.45,Math.min(1,(Number(style.opacity)||100)/100));
    const hexToRgba=(hex,a)=>{const h=String(hex||'').replace('#','');if(!/^[0-9a-fA-F]{6}$/.test(h))return `rgba(22,131,255,${a})`;return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;};
    panel.style.setProperty('--bubble-in-rgba',hexToRgba(style.incomingColor||'#142b3d',alpha));
    panel.style.setProperty('--bubble-out-rgba',hexToRgba(style.color,alpha));
    panel.style.setProperty('--bubble-opacity',1);
    panel.classList.remove('bubble-glass','bubble-soft','bubble-compact','bubble-classic','bubble-minimal','bubble-outline');
    if(style.bubble==='glass')panel.classList.add('bubble-glass');
    if(style.bubble==='soft')panel.classList.add('bubble-soft');
    if(style.bubble==='compact')panel.classList.add('bubble-compact');
    if(style.bubble==='classic')panel.classList.add('bubble-classic');
    if(style.bubble==='minimal')panel.classList.add('bubble-minimal');
    if(style.bubble==='outline')panel.classList.add('bubble-outline');
    document.querySelectorAll('.chatBgOption').forEach(x=>x.classList.toggle('active',x.dataset.bg===style.bg&&!style.customBg));
    document.querySelectorAll('.chatBubbleOption').forEach(x=>x.classList.toggle('active',x.dataset.bubble===style.bubble));
    document.querySelectorAll('.chatColor').forEach(x=>x.classList.toggle('active',x.dataset.color===style.color));
    const op=document.getElementById('chatOpacity');if(op)op.value=style.opacity;
    const ov=document.getElementById('chatOpacityValue');if(ov)ov.textContent=style.opacity+' %';
  }
  async function open(){await load();apply();overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.classList.add('chatCustomizeOpen');}
  async function close(){await save();overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.classList.remove('chatCustomizeOpen');}
  openBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();},true);
  openBtn.addEventListener('pointerdown',e=>e.stopPropagation(),true);
  openBtn.addEventListener('touchstart',e=>e.stopPropagation(),{capture:true,passive:true});
  closeBtn?.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await close();});
  doneBtn?.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await close();});
  saveBtn?.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await save();});
  overlay.addEventListener('click',async e=>{if(e.target===overlay)await close();});
  document.querySelectorAll('[data-chat-custom-tab]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const n=btn.dataset.chatCustomTab;document.querySelectorAll('[data-chat-custom-tab]').forEach(x=>x.classList.toggle('active',x===btn));document.querySelector('[data-chat-custom-section=\"'+n+'\"]')?.scrollIntoView({behavior:'smooth',block:'nearest'});}));
  document.querySelectorAll('.chatBgOption').forEach(btn=>btn.addEventListener('click',()=>{style.bg=btn.dataset.bg;style.customBg='';apply();save();}));
  document.querySelectorAll('.chatBubbleOption').forEach(btn=>btn.addEventListener('click',()=>{style.bubble=btn.dataset.bubble;apply();save();}));
  document.querySelectorAll('.chatColor[data-color]').forEach(btn=>btn.addEventListener('click',()=>{style.color=btn.dataset.color;apply();save();}));
   document.querySelectorAll('.chatColor[data-incoming-color]').forEach(btn=>btn.addEventListener('click',()=>{style.incomingColor=btn.dataset.incomingColor;apply();save();}));
  document.getElementById('chatOpacity')?.addEventListener('input',e=>{style.opacity=Number(e.target.value);apply();save();});
  document.getElementById('chatBgUpload')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{style.customBg=String(r.result);style.bg='custom';apply();save();};r.readAsDataURL(f);});
  resetBtn?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();style={...defaults};apply();save();});
  // Permet à selectEvent() de recharger le fond dès que l'événement et l'utilisateur sont connus.
  window.loadMyEventChatStyle=async()=>{await load();apply();};
  window.addEventListener('beforeunload',save);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
  load().then(apply);
})();
