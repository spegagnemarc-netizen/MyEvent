/* ===== original inline script 17 ===== */
/* V53.17 — Réservations multiples pour un planning IA */
let aiPlanReservationsCache=[];
function aiReservationDateTimeValue(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function aiReservationStatusLabel(r){
  if(!r)return 'À préparer';
  if(r.status==='confirmed')return 'Confirmée';
  if(r.status==='cancelled')return 'Annulée';
  return 'À confirmer';
}
async function renderAiPlanReservations(plan,items,targetId){
  const box=$(targetId||'aiPlanReservationPanelBox');
  if(!box)return;
  if(!plan||!Array.isArray(items)||!items.length){box.innerHTML='';return;}
  window.__myeventAiReservationPlan=plan;
  window.__myeventAiReservationItems=items;
  const q=await sb.from('event_outing_plan_reservations').select('*').eq('plan_id',plan.id).order('step_order',{ascending:true});
  if(q.error){
    box.innerHTML='<div class="reservationBox"><div class="reservationTitle">📅 Réservations du planning IA</div><div class="muted">⚠️ La table des réservations IA n’est pas encore activée dans Supabase.</div></div>';
    return;
  }
  aiPlanReservationsCache=q.data||[];
  const rows=items.map((item,i)=>{
    const step=i+1;
    const r=aiPlanReservationsCache.find(x=>Number(x.step_order)===step)||null;
    const type=aiPlanCandidateLabel(String(item.outing_type||'activity'));
    const when=item.start_time?' · 🕐 '+esc(item.start_time):'';
    const status=aiReservationStatusLabel(r);
    return '<div class="aiPlanReservationRow" data-ai-res-step="'+step+'">'+
      '<div class="aiPlanReservationMain"><b>'+step+'. '+esc(item.name||'Étape')+'</b><div class="muted">'+type+when+' · '+esc(status)+'</div></div>'+
      '<button type="button" class="secondary aiPlanReservationOpen" data-ai-res-open="'+step+'" onclick="event.preventDefault();event.stopPropagation();window.__myeventOpenAiReservation(this);return false;" onpointerup="event.preventDefault();event.stopPropagation();window.__myeventOpenAiReservation(this);return false;">'+(r&&r.status!=='cancelled'?'✏️ Modifier':'📅 Préparer')+'</button>'+
      '<div class="aiPlanReservationFormHost" id="aiResHost'+step+'"></div>'+
      '</div>';
  }).join('');
  box.innerHTML='<div class="reservationBox aiPlanReservationBox"><div class="reservationTitle">📅 Réservations du planning IA</div><div class="muted">Une réservation indépendante pour chaque étape du parcours.</div>'+rows+'</div>';
  box.querySelectorAll('[data-ai-res-open]').forEach(btn=>btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();openAiPlanReservationForm(plan,items,Number(btn.dataset.aiResOpen));}));
}
window.__myeventOpenAiReservation=function(btn){
  const plan=window.__myeventAiReservationPlan;
  const items=window.__myeventAiReservationItems;
  const step=Number(btn?.dataset?.aiResOpen);
  if(plan&&Array.isArray(items)&&step>0)openAiPlanReservationForm(plan,items,step);
};
function openAiPlanReservationForm(plan,items,step){
  const item=items.find((x,i)=>i+1===step);
  if(!item)return;
  const host=$('aiResHost'+step);
  if(!host)return;
  host.innerHTML='';
  const existing=aiPlanReservationsCache.find(x=>Number(x.step_order)===step)||null;
  let dateTime=aiReservationDateTimeValue(existing?.reserved_at);
  if(!dateTime&&item.start_time&&event?.event_date)dateTime=String(event.event_date).slice(0,10)+'T'+String(item.start_time).slice(0,5);
  const people=Math.max(1,Number(existing?.party_size||aiOutingPlanData?.people||$('outingPeople')?.value||10)||10);
  host.innerHTML='<div class="aiPlanReservationEdit">'+
    '<label>Date et heure<input type="datetime-local" id="aiResDate'+step+'" value="'+escAttr(dateTime)+'"></label>'+
    '<label>Personnes<input type="number" min="1" step="1" id="aiResPeople'+step+'" value="'+people+'" inputmode="numeric"></label>'+
    '<label>Note<textarea id="aiResNote'+step+'" placeholder="Ex. table intérieure, anniversaire…">'+esc(existing?.note||'')+'</textarea></label>'+
    '<div class="reservationActions"><button type="button" class="secondary" data-ai-res-save="'+step+'">💾 Enregistrer</button><button type="button" class="secondary" data-ai-res-cancel="'+step+'">Annuler</button></div>'+
    '</div>';
  host.querySelector('[data-ai-res-cancel]')?.addEventListener('click',()=>{host.innerHTML='';});
  host.querySelector('[data-ai-res-save]')?.addEventListener('click',()=>saveAiPlanReservation(plan,item,step));
}
async function saveAiPlanReservation(plan,item,step){
  const dateTime=$('aiResDate'+step)?.value||'';
  const people=Math.max(1,Number($('aiResPeople'+step)?.value||1)||1);
  const note=$('aiResNote'+step)?.value||null;
  if(!dateTime){alert('Choisis une date et une heure.');return;}
  const d=new Date(dateTime);
  if(Number.isNaN(d.getTime())){alert('La date ou l’heure est invalide.');return;}
  const btn=document.querySelector('[data-ai-res-save="'+step+'"]');
  if(btn){btn.disabled=true;btn.textContent='⏳ Enregistrement…';}
  try{
    const payload={plan_id:plan.id,event_id:event.id,step_order:step,reserved_at:d.toISOString(),party_size:people,note,status:'pending',created_by:user?.id||null};
    const r=await sb.from('event_outing_plan_reservations').upsert(payload,{onConflict:'plan_id,step_order'}).select('*').single();
    if(r.error)throw new Error(r.error.message);
    const ir=await sb.from('event_outing_plan_items').select('*').eq('plan_id',plan.id).order('step_order',{ascending:true});
    if(ir.error)throw new Error(ir.error.message);
    await renderAiPlanReservations(plan,ir.data||[]);
  }catch(e){
    alert('Impossible d’enregistrer la réservation : '+(e.message||String(e)));
    if(btn){btn.disabled=false;btn.textContent='💾 Enregistrer';}
  }
}
// V54.4 : gestion prioritaire des taps mobiles en phase capture.
// Certains conteneurs de l’événement interceptent les clics avant le listener local.
document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-ai-plan-edit]');
  if(edit){ e.preventDefault(); e.stopPropagation(); window.__myeventOpenAiPlanEditor?.(); return; }
  const res=e.target.closest?.('[data-ai-res-open]');
  if(res){ e.preventDefault(); e.stopPropagation(); window.__myeventOpenAiReservation?.(res); return; }
},true);
document.addEventListener('pointerup',e=>{
  const edit=e.target.closest?.('[data-ai-plan-edit]');
  if(edit){ e.preventDefault(); e.stopPropagation(); window.__myeventOpenAiPlanEditor?.(); return; }
  const res=e.target.closest?.('[data-ai-res-open]');
  if(res){ e.preventDefault(); e.stopPropagation(); window.__myeventOpenAiReservation?.(res); return; }
},true);
