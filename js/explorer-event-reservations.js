(function(){
 'use strict';
 async function list(eventId,kind){
  if(!eventId||typeof sb==='undefined'||!sb)return [];
  let query=sb.from('personal_reservations').select('id,owner_id,kind,details,created_at').eq('event_id',eventId);
  if(kind)query=query.eq('kind',kind);
  const r=await query.order('created_at',{ascending:true});
  if(r.error){if(['42P01','PGRST205'].includes(r.error.code))return [];throw Error(r.error.message);}
  return (r.data||[]).map(row=>({...row.details,_reservation_id:row.id,_user_id:row.owner_id,_created_at:row.created_at,_kind:row.kind}));
 }
 for(const [name,kind] of [['getEventAccommodations','accommodation'],['getEventTransports','transport']]){
  const original=window[name];if(typeof original!=='function')continue;
  window[name]=async eventId=>{const [legacy,personal]=await Promise.all([original(eventId),list(eventId,kind)]);return [...legacy,...personal];};
 }
 window.MyEventExplorerEventReservations={list:async eventId=>(await list(eventId)).filter(r=>!['transport','accommodation'].includes(r._kind))};
})();
