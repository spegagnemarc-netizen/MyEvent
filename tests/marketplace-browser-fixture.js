/* Deliberate test double for UI interactions; SQL/RLS runs separately in PGlite. */
(()=>{
  let current={id:'test-buyer'},callback,fail=false;
  const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 230"><rect width="300" height="230" fill="#e2e7dc"/><rect x="93" y="28" width="114" height="176" rx="15" fill="#294b3d"/><circle cx="150" cy="82" r="26" fill="#163227" stroke="#78927d" stroke-width="4"/><circle cx="150" cy="150" r="35" fill="#163227" stroke="#78927d" stroke-width="4"/></svg>');
  const db={marketplace_listings:[{id:'listing-one',owner_id:'test-seller',title:'Enceinte portable de test',description:'Une enceinte de test avec housse et chargeur, pour les contrôles de la marketplace.',mode:'rent',category:'sound',price_cents:3500,city:'Lyon',condition:'good',status:'active',image_paths:['test-photo'],created_at:'2026-09-01'}, {id:'listing-two',owner_id:'test-buyer',title:'Éclairage de test',description:'Un éclairage de test pour vérifier les filtres et la modification des annonces.',mode:'sale',category:'lights',price_cents:9900,city:'Paris',condition:'like_new',status:'active',image_paths:['test-photo'],created_at:'2026-09-02'}],marketplace_favorites:[],marketplace_threads:[],marketplace_messages:[]};
  function from(table){
    let conditions=[],op='read',value,range=null,sort=null,one=false,max=Infinity;
    const q={select(){return q;},eq(k,v){conditions.push([k,v]);return q;},order(k,{ascending}){sort=[k,ascending];return q;},range(a,b){range=[a,b];return q;},limit(n){max=n;return q;},single(){one=true;return q;},insert(v){op='insert';value=v;return q;},update(v){op='update';value=v;return q;},delete(){op='delete';return q;},then(resolve,reject){return Promise.resolve().then(()=>{
      if(fail){fail=false;return {error:{message:'Erreur réseau de test'}};}
      let rows=db[table].filter(row=>conditions.every(([k,v])=>row[k]===v));
      if(table==='marketplace_listings'&&op==='read')rows=rows.filter(r=>r.status==='active'||r.owner_id===current.id);
      if(op==='insert'){const row={id:crypto.randomUUID(),image_paths:[],created_at:new Date().toISOString(),...value};db[table].push(row);rows=[row];}
      if(op==='update')rows.forEach(row=>Object.assign(row,value));
      if(op==='delete')db[table]=db[table].filter(row=>!rows.includes(row));
      if(sort)rows.sort((a,b)=>(String(a[sort[0]]).localeCompare(String(b[sort[0]])))*(sort[1]?1:-1));
      if(range)rows=rows.slice(range[0],range[1]+1);rows=rows.slice(0,max);
      return {data:structuredClone(one?rows[0]:rows),error:null};
    }).then(resolve,reject);}};return q;
  }
  window.supabase={createClient:()=>({from,auth:{onAuthStateChange(cb){callback=cb;setTimeout(()=>cb('INITIAL_SESSION',{user:current}),0);},async signInWithPassword(){current={id:'test-buyer'};callback('SIGNED_IN',{user:current});return {};}},storage:{from:()=>({createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:svg}))}),upload:async()=>({data:{}}),remove:async()=>({data:[]})})},rpc:async(_,{listing})=>{let t=db.marketplace_threads.find(t=>t.listing_id===listing&&t.buyer_id===current.id);if(!t){const item=db.marketplace_listings.find(i=>i.id===listing);t={id:crypto.randomUUID(),listing_id:listing,listing_title:item.title,buyer_id:current.id,seller_id:item.owner_id,created_at:new Date().toISOString()};db.marketplace_threads.push(t);}return {data:t.id};}})};
  document.addEventListener('DOMContentLoaded',()=>{
    const controls=document.createElement('div');controls.style='padding:8px;background:#ffdf91;display:flex;gap:8px';
    for(const [text,action] of [['Simuler une erreur réseau',()=>{fail=true;}],['Déconnecter le compte test',()=>{current=null;callback('SIGNED_OUT',null);} ]]){const b=document.createElement('button');b.textContent=text;b.onclick=action;controls.append(b);}document.body.prepend(controls);
  });
})();
