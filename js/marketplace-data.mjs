export const categories=[['sound','Sonorisation','♫'],['lights','Éclairage','✧'],['photo','Photo & vidéo','▣'],['furniture','Mobilier','▤'],['decoration','Décoration','✿'],['outdoor','Plein air','△']];
export const conditions={new:'Neuf',like_new:'Comme neuf',good:'Bon état',used:'État d’usage'};
export const money=cents=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:cents%100?2:0}).format(cents/100);
export function validateListing(fields){
  const title=String(fields.title||'').trim(),description=String(fields.description||'').trim(),city=String(fields.city||'').trim();
  const price=Number(fields.price),price_cents=Math.round(price*100);
  if(title.length<5||title.length>90)throw new Error('Le titre doit contenir entre 5 et 90 caractères.');
  if(description.length<20||description.length>1800)throw new Error('La description doit contenir entre 20 et 1 800 caractères.');
  if(city.length<2||city.length>60)throw new Error('Indiquez une ville entre 2 et 60 caractères.');
  if(!Number.isFinite(price)||price_cents<100||price_cents>10000000||Math.abs(price*100-price_cents)>.00001)throw new Error('Indiquez un prix entre 1 et 100 000 €, avec deux décimales maximum.');
  if(!['rent','sale'].includes(fields.mode)||!categories.some(([id])=>id===fields.category)||!Object.hasOwn(conditions,fields.condition))throw new Error('Vérifiez le type, la catégorie et l’état du matériel.');
  return {title,description,city,price_cents,mode:fields.mode,category:fields.category,condition:fields.condition};
}
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterListings(items,{mode='all',category='all',query='',city='',sort='featured',favorites=null}={}){
  const words=normalize(query).trim().split(/\s+/).filter(Boolean);
  return items.filter(item=>(mode==='all'||item.mode===mode)&&(category==='all'||item.category===category)&&(!city||normalize(item.city)===normalize(city))&&(!favorites||favorites.has(item.id))&&words.every(word=>normalize(item.title+' '+item.description+' '+item.city).includes(word)))
    .sort((a,b)=>sort==='priceAsc'?a.price_cents-b.price_cents:sort==='priceDesc'?b.price_cents-a.price_cents:new Date(b.created_at)-new Date(a.created_at));
}
export function createMarketplaceStore(client){
  async function unwrap(request){const result=await request;if(result.error)throw result.error;return result.data;}
  return {
    async listings(own=false,userId){
      let query=client.from('marketplace_listings').select('*').order('created_at',{ascending:false});
      query=own?query.eq('owner_id',userId):query.eq('status','active');
      // Page through the PostgREST cap rather than silently hiding listings after 1,000.
      let rows=[],start=0;while(true){const page=await unwrap(query.range(start,start+199));rows.push(...page);if(page.length<200)break;start+=200;}return rows;
    },
    favorites:()=>unwrap(client.from('marketplace_favorites').select('listing_id')),
    favorite:(id,userId,save)=>unwrap(save?client.from('marketplace_favorites').insert({listing_id:id,user_id:userId}):client.from('marketplace_favorites').delete().eq('listing_id',id).eq('user_id',userId)),
    create:values=>unwrap(client.from('marketplace_listings').insert({...values,status:'draft'}).select().single()),
    update:(id,values)=>unwrap(client.from('marketplace_listings').update(values).eq('id',id).select().single()),
    upload:(path,file)=>unwrap(client.storage.from('marketplace-images').upload(path,file,{contentType:'image/jpeg',upsert:false})),
    removeImages:paths=>paths.length?unwrap(client.storage.from('marketplace-images').remove(paths)):Promise.resolve(),
    imageUrls:paths=>paths.length?unwrap(client.storage.from('marketplace-images').createSignedUrls(paths,3600)):Promise.resolve([]),
    contact:id=>unwrap(client.rpc('marketplace_contact',{listing:id})),
    threads:()=>unwrap(client.from('marketplace_threads').select('*').order('created_at',{ascending:false})),
    messages:async id=>(await unwrap(client.from('marketplace_messages').select('*').eq('thread_id',id).order('created_at',{ascending:false}).limit(200))).reverse(),
    send:(thread_id,sender_id,body,id)=>unwrap(client.from('marketplace_messages').insert({id,thread_id,sender_id,body}).select().single())
  };
}
