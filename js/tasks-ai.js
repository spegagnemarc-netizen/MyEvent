/* Task suggestions are drafts. Saving reuses event_tasks and its existing RLS. */
(()=>{
 'use strict';
 const el=id=>document.getElementById(id);
 if(!el('tasksAiBox'))return;
 let draft=[],owner=null,pending=false,saving=false,revision=0,request=null,uncertain=false;
 const key=v=>String(v||'').trim().toLocaleLowerCase('fr');
 const context=()=>({eventId:event?.id,userId:user?.id});
 const same=c=>c?.eventId===event?.id&&c?.userId===user?.id;
 const notice=(text,error=false)=>{const n=el('tasksAiMsg');n.textContent=text;n.classList.toggle('err',error);};
 function render(){
  const box=el('tasksAiResults');box.replaceChildren();
  if(!draft.length)return;
  const p=document.createElement('p');p.textContent='Propositions modifiables : sélectionne les tâches à ajouter. Aucun responsable ni échéance ne sera imposé.';box.append(p);
  draft.forEach(item=>{
   const row=document.createElement('div');row.className='taskAiSuggestion';
   const check=document.createElement('input');check.type='checkbox';check.checked=item.selected;check.setAttribute('aria-label','Sélectionner cette tâche');check.onchange=()=>item.selected=check.checked;
   const title=document.createElement('input');title.value=item.title;title.maxLength=180;title.setAttribute('aria-label','Tâche proposée');title.oninput=()=>item.title=title.value;
   const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Retirer cette proposition');remove.onclick=()=>{draft=draft.filter(x=>x!==item);render();};
   const note=document.createElement('input');note.value=item.note;note.maxLength=1000;note.className='taskAiNote';note.setAttribute('aria-label','Précisions de la tâche');note.oninput=()=>item.note=note.value;
   for(const input of [check,title,remove,note])input.disabled=saving;
   row.append(check,title,remove,note);box.append(row);
  });
  const add=document.createElement('button');add.type='button';add.id='tasksAiAddBtn';add.className='materialAiAdd';add.textContent='✅ Ajouter les tâches sélectionnées';add.disabled=saving||uncertain;add.onclick=save;box.append(add);
 }
 async function generate(){
  if(pending||saving||!event||!user)return;
  const captured=context(),ticket=++revision,controller=new AbortController();request=controller;
  pending=true;el('tasksAiGenerateBtn').disabled=true;let timer;
  try{
   owner=captured;draft=[];uncertain=false;render();notice('🤖 L’IA prépare les tâches…');
   const body={mode:'tasks',event_name:event.name||'',event_type:event.event_type||'',people:Math.max(1,Math.min(5000,Number(el('tasksAiPeople').value)||30)),meal:el('tasksAiMeal').value.trim(),details:el('tasksAiDetails').value.trim()};
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('La génération prend trop de temps. Réessaie dans quelques instants.'));},60000);});
   const work=(async()=>{
    const session=await sb.auth.getSession(),token=session.data?.session?.access_token;
    if(session.error||!token)throw Error('Ta session a expiré. Reconnecte-toi.');
    if(controller.signal.aborted)throw Error('Génération annulée.');
    const response=await fetch('/api/generate-materials',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Le service IA est indisponible. Réessaie plus tard.');
    const seen=new Set();return (Array.isArray(data.items)?data.items:[]).filter(x=>{const k=key(x?.title);if(!k||seen.has(k))return false;seen.add(k);return true;}).slice(0,15).map(x=>({id:crypto.randomUUID(),title:String(x.title).slice(0,180),note:String(x.note||'').slice(0,1000),selected:true}));
   })();
   const items=await Promise.race([work,timeout]);if(ticket!==revision||!same(captured))return;
   if(!items.length)throw Error('Aucune tâche proposée. Précise le contexte puis réessaie.');
   draft=items;render();notice(draft.length+' tâches proposées. Vérifie-les avant de les ajouter.');
  }catch(error){if(ticket===revision&&same(captured))notice(error.name==='AbortError'?'Génération annulée.':error instanceof TypeError?'Connexion au service IA impossible. Vérifie ta connexion.':error.message,true);}
  finally{clearTimeout(timer);controller.abort();if(request===controller){request=null;pending=false;el('tasksAiGenerateBtn').disabled=false;}}
 }
 async function save(){
  if(saving||pending||uncertain)return;
  if(!same(owner)){draft=[];render();notice('L’événement ou le compte a changé. Génère une nouvelle proposition.',true);return;}
  const captured={...owner},seen=new Set(),selected=draft.filter(x=>{const k=key(x.title);if(!x.selected||!k||seen.has(k))return false;seen.add(k);return true;});
  if(!selected.length){notice('Sélectionne au moins une tâche.',true);return;}
  saving=true;render();notice('Enregistrement des tâches…');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let inserting=false;
  try{
   const existing=await sb.from('event_tasks').select('id,title').eq('event_id',captured.eventId).abortSignal(controller.signal);
   if(existing.error)throw Error('Impossible de vérifier les tâches existantes. Réessaie plus tard.');
   if(!same(captured))throw Error('L’événement a changé. Aucune tâche ajoutée.');
   const titles=new Set((existing.data||[]).map(x=>key(x.title))),ids=new Set((existing.data||[]).map(x=>x.id));
   const fresh=selected.filter(x=>!titles.has(key(x.title))&&!ids.has(x.id));
   if(!fresh.length){notice('Ces tâches sont déjà présentes dans l’événement.');return;}
   inserting=true;
   const result=await sb.from('event_tasks').insert(fresh.map(x=>({id:x.id,event_id:captured.eventId,title:x.title.trim(),note:x.note.trim()||null,status:'todo',due_at:null,created_by:captured.userId}))).select('*').abortSignal(controller.signal);
   if(result.error)throw Error('Impossible de confirmer l’enregistrement. Actualise les tâches avant de réessayer.');
   if(!same(captured))return;
   eventTasks=[...eventTasks.filter(x=>!result.data.some(y=>y.id===x.id)),...result.data];renderEventTasks();draft=[];render();notice(result.data.length+' tâches ajoutées. Choisis leurs responsables dans la liste.');
  }catch(error){if(inserting)uncertain=true;if(same(captured))notice(error.name==='AbortError'?'Délai dépassé. Actualise les tâches pour vérifier l’enregistrement avant de recommencer.':error.message,true);}
  finally{clearTimeout(timer);saving=false;if(same(captured))render();}
 }
 function cancel(){if(saving)return;revision++;request?.abort();request=null;pending=false;draft=[];owner=null;el('tasksAiGenerateBtn').disabled=false;render();el('tasksAiForm').classList.add('hidden');notice('');}
 el('tasksAiOpenBtn').addEventListener('click',()=>{if(saving)return;if(!same(owner)){draft=[];owner=null;render();notice('');}el('tasksAiForm').classList.remove('hidden');});
 el('tasksAiCancelBtn').addEventListener('click',cancel);
 el('tasksAiGenerateBtn').addEventListener('click',generate);
})();
