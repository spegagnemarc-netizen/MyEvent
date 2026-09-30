// MyEvent — Qui fait quoi ?
let eventTasks=[],eventTaskAssignees=[],eventTaskProfiles=[],eventTasksChannel=null,eventTasksChannelEventId=null;
function taskIsManager(){return !!(event&&user&&(event.creator_id===user.id||activeEventRole==='coorganizer'));}
function taskPerson(id){const p=eventTaskProfiles.find(x=>x.id===id);return p?.display_name||p?.username||'Participant';}
function taskStatusLabel(s){return s==='done'?'🟢 Terminé':s==='doing'?'🔵 En cours':'🟠 À faire';}
function taskDueLabel(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':'📅 '+d.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});}
async function loadEventTasks(){
  if(!event||!user)return;
  const box=$('eventTasksList');if(!box)return;
  box.innerHTML='<p class="muted">Chargement…</p>';
  const [tr,ar,mr]=await Promise.all([
    sb.from('event_tasks').select('*').eq('event_id',event.id).order('created_at',{ascending:true}),
    sb.from('event_task_assignees').select('*').eq('event_id',event.id).order('created_at',{ascending:true}),
    sb.from('event_members').select('user_id').eq('event_id',event.id)
  ]);
  if(tr.error){box.innerHTML='<p class="muted">Impossible de charger les tâches : '+esc(tr.error.message)+'</p>';return;}
  eventTasks=tr.data||[];eventTaskAssignees=ar.error?[]:(ar.data||[]);
  const ids=[...new Set([...(mr.data||[]).map(x=>x.user_id),event.creator_id,...eventTaskAssignees.map(x=>x.user_id)].filter(Boolean))];
  eventTaskProfiles=[];
  if(ids.length){const pr=await sb.from('profiles').select('id,display_name,username').in('id',ids);if(!pr.error)eventTaskProfiles=pr.data||[];}
  renderEventTasks();startEventTasksRealtime();
}
function renderEventTasks(){
  const box=$('eventTasksList'),sum=$('eventTasksSummary');if(!box)return;
  const counts={todo:0,doing:0,done:0};eventTasks.forEach(t=>counts[t.status]=(counts[t.status]||0)+1);
  if(sum)sum.innerHTML='<span class="supplyChip">✅ '+eventTasks.length+' tâche'+(eventTasks.length>1?'s':'')+'</span><span class="supplyChip supplyStatusPlanned">🟠 '+counts.todo+' à faire</span><span class="supplyChip supplyStatusReserved">🔵 '+counts.doing+' en cours</span><span class="supplyChip supplyStatusBrought">🟢 '+counts.done+' terminée'+(counts.done>1?'s':'')+'</span>';
  if(!eventTasks.length){box.innerHTML='<div class="hallEmpty">Aucune tâche pour le moment. Ajoute par exemple « Réserver le restaurant » ou « Préparer la décoration ».</div>';return;}
  const manager=taskIsManager();
  const opts='<option value="">Ajouter un responsable…</option>'+eventTaskProfiles.map(p=>'<option value="'+esc(p.id)+'">'+esc(taskPerson(p.id))+'</option>').join('');
  box.innerHTML=eventTasks.map(t=>{
    const people=eventTaskAssignees.filter(a=>a.task_id===t.id),mine=people.some(a=>a.user_id===user.id),canEdit=manager||t.created_by===user.id;
    const who=people.length?people.map(a=>'<span class="supplyChip">👤 '+esc(taskPerson(a.user_id))+(manager||a.user_id===user.id?' <button type="button" class="taskMiniRemove secondary" style="padding:0 5px;min-width:0;width:auto;height:auto;min-height:0;border:0;background:transparent;font-size:16px;line-height:1" data-task-unassign="'+esc(t.id)+'" data-task-user="'+esc(a.user_id)+'" aria-label="Retirer">×</button>':'')+'</span>').join(' '):'<span class="muted">Aucun responsable</span>';
    return '<div class="supplyCard" data-task-id="'+esc(t.id)+'"><div class="supplyCompactTitle">'+esc(t.title)+'</div><div class="supplyCompactMeta"><span class="supplyChip '+(t.status==='done'?'supplyStatusBrought':t.status==='doing'?'supplyStatusReserved':'supplyStatusPlanned')+'">'+taskStatusLabel(t.status)+'</span>'+(t.due_at?'<span class="supplyChip">'+esc(taskDueLabel(t.due_at))+'</span>':'')+'</div>'+(t.note?'<div class="muted" style="margin-top:6px">'+esc(t.note)+'</div>':'')+'<div style="margin-top:8px">'+who+'</div><div class="supplyCompactActions">'+(!mine?'<button type="button" data-task-claim="'+esc(t.id)+'">🙋 Je m’en occupe</button>':'')+(mine||manager?'<button type="button" class="secondary" data-task-status="'+esc(t.id)+'">'+taskStatusLabel(t.status)+'</button>':'')+(manager?'<select data-task-assign="'+esc(t.id)+'">'+opts+'</select>':'')+(canEdit?'<button type="button" class="secondary" data-task-edit="'+esc(t.id)+'">✏️ Modifier</button><button type="button" class="secondary" data-task-delete="'+esc(t.id)+'">🗑️ Supprimer</button>':'')+'</div></div>';
  }).join('');
}
function taskForm(open){$('eventTaskForm')?.classList.toggle('hidden',!open);if(!open){$('eventTaskTitle').value='';$('eventTaskDue').value='';$('eventTaskNote').value='';}}
async function addEventTask(){
  if(!event||!user)return;const title=String($('eventTaskTitle')?.value||'').trim();if(!title){msg('eventTasksMsg','Indique la tâche à réaliser.','err');return;}
  const due=$('eventTaskDue')?.value||null,note=String($('eventTaskNote')?.value||'').trim()||null;
  const r=await sb.from('event_tasks').insert({event_id:event.id,title,note,due_at:due?new Date(due).toISOString():null,status:'todo',created_by:user.id}).select('*').single();
  if(r.error){msg('eventTasksMsg','Impossible d’ajouter : '+r.error.message,'err');return;}taskForm(false);await loadEventTasks();msg('eventTasksMsg','Tâche ajoutée.','ok');
}
async function assignEventTask(taskId,userId){
  if(!taskId||!userId)return;
  if(eventTaskAssignees.some(a=>a.task_id===taskId&&a.user_id===userId)){msg('eventTasksMsg','Ce participant est déjà responsable de cette tâche.','ok');return;}
  const r=await sb.from('event_task_assignees').insert({task_id:taskId,event_id:event.id,user_id:userId});
  if(r.error){msg('eventTasksMsg','Impossible d’attribuer : '+r.error.message,'err');return;}await loadEventTasks();
}
async function unassignEventTask(taskId,userId){
  const r=await sb.from('event_task_assignees').delete().eq('task_id',taskId).eq('user_id',userId);
  if(r.error){msg('eventTasksMsg','Impossible de retirer : '+r.error.message,'err');return;}await loadEventTasks();
}
async function cycleEventTask(taskId){
  const t=eventTasks.find(x=>x.id===taskId);if(!t)return;const next=t.status==='todo'?'doing':t.status==='doing'?'done':'todo';
  const r=await sb.from('event_tasks').update({status:next,updated_at:new Date().toISOString()}).eq('id',taskId).eq('event_id',event.id);
  if(r.error){msg('eventTasksMsg','Impossible de modifier : '+r.error.message,'err');return;}await loadEventTasks();
}
async function editEventTask(taskId){
  const t=eventTasks.find(x=>x.id===taskId);if(!t)return;
  const title=prompt('Tâche ?',t.title);if(title===null)return;const note=prompt('Note (optionnel) :',t.note||'');if(note===null)return;
  const r=await sb.from('event_tasks').update({title:title.trim()||t.title,note:note.trim()||null,updated_at:new Date().toISOString()}).eq('id',taskId).eq('event_id',event.id);
  if(r.error){msg('eventTasksMsg','Impossible de modifier : '+r.error.message,'err');return;}await loadEventTasks();
}
async function deleteEventTask(taskId){
  const t=eventTasks.find(x=>x.id===taskId);if(!t||!confirm('Supprimer « '+t.title+' » ?'))return;
  const r=await sb.from('event_tasks').delete().eq('id',taskId).eq('event_id',event.id);if(r.error){msg('eventTasksMsg','Impossible de supprimer : '+r.error.message,'err');return;}await loadEventTasks();
}
async function startEventTasksRealtime(){
  if(!event||eventTasksChannelEventId===event.id)return;
  if(eventTasksChannel){try{await sb.removeChannel(eventTasksChannel);}catch(_){}}
  eventTasksChannelEventId=event.id;
  eventTasksChannel=sb.channel('event-tasks-'+event.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'event_tasks',filter:'event_id=eq.'+event.id},()=>loadEventTasks())
    .on('postgres_changes',{event:'*',schema:'public',table:'event_task_assignees',filter:'event_id=eq.'+event.id},()=>loadEventTasks())
    .subscribe();
}
document.addEventListener('click',e=>{
  if(e.target.closest('#eventTaskAddBtn')){taskForm(true);return;}
  if(e.target.closest('#eventTaskCancelBtn')){taskForm(false);return;}
  if(e.target.closest('#eventTaskSaveBtn')){addEventTask();return;}
  const claim=e.target.closest('[data-task-claim]');if(claim){assignEventTask(claim.dataset.taskClaim,user.id);return;}
  const un=e.target.closest('[data-task-unassign]');if(un){unassignEventTask(un.dataset.taskUnassign,un.dataset.taskUser);return;}
  const st=e.target.closest('[data-task-status]');if(st){cycleEventTask(st.dataset.taskStatus);return;}
  const ed=e.target.closest('[data-task-edit]');if(ed){editEventTask(ed.dataset.taskEdit);return;}
  const del=e.target.closest('[data-task-delete]');if(del){deleteEventTask(del.dataset.taskDelete);return;}
});
document.addEventListener('change',e=>{const a=e.target.closest('[data-task-assign]');if(a&&a.value){assignEventTask(a.dataset.taskAssign,a.value);a.value='';}});
