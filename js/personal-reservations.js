(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MyEventPersonalReservations=api;})(typeof window==='object'?window:this,function(){
 'use strict';
 function create(client,owner){
  async function result(query){const r=await query;if(r.error)throw Error(['42P01','PGRST205'].includes(r.error.code)?'Les réservations personnelles ne sont pas encore activées dans cet environnement.':r.error.message);return r.data;}
  return {
   list:()=>result(client.from('personal_reservations').select('*').eq('owner_id',owner).order('created_at',{ascending:false})),
   save:(kind,details,id)=>result(id?client.from('personal_reservations').update({kind,details}).eq('id',id).eq('owner_id',owner).select().single():client.from('personal_reservations').insert({owner_id:owner,kind,details,event_id:null}).select().single()),
   attach:(id,eventId)=>result(client.from('personal_reservations').update({event_id:eventId||null}).eq('id',id).eq('owner_id',owner).select().single()),
   remove:id=>result(client.from('personal_reservations').delete().eq('id',id).eq('owner_id',owner))
  };
 }
 async function proof(file){
  if(!file)return null;
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type)||file.size<1||file.size>204800)throw Error('Justificatif : PDF, PNG ou JPEG, 200 Ko maximum.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const valid=file.type==='application/pdf'?String.fromCharCode(...bytes.slice(0,5))==='%PDF-':file.type==='image/png'?[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!valid)throw Error('Le contenu ne correspond pas au type du justificatif.');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
  return {name:file.name.slice(0,150),type:file.type,size:bytes.length,base64:btoa(binary)};
 }
 return {create,proof};
});
