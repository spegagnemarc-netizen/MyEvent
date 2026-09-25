import {categories,conditions,money,validateListing,filterListings,createMarketplaceStore} from './marketplace-data.mjs';
import {projectUrl,publishableKey} from './marketplace-config.mjs';

const root=document.getElementById('myeventMarketplace'),$=id=>root.querySelector('#'+id);
let client,store,user=null,items=[],favorites=new Set(),photos=new Map(),editing=null,thread=null;
let own=false,onlyFavorites=false,loading=false,generation=0,toastTimer=0,messageTimer=0,formBusy=false,threadRevision=0;
const filters={mode:'all',category:'all',query:'',city:'',sort:'featured'};
const labelCategory=id=>categories.find(c=>c[0]===id)?.[1]||'Matériel';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const button=(text,className,action)=>{const node=el('button',className,text);node.type='button';node.addEventListener('click',action);return node;};
function toast(text){$('marketToast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('marketToast').textContent='',5000);}
function errorMessage(error){
  if(['42P01','PGRST205','PGRST202'].includes(error?.code)||/bucket not found/i.test(error?.message||''))return 'La marketplace doit encore être activée par l’équipe MyEvent. Réessayez après son activation.';
  if(error?.code==='42501')return 'Cette action n’est pas autorisée pour votre compte.';
  if(/fetch|network/i.test(error?.message||''))return 'Connexion interrompue. Vérifiez votre réseau puis réessayez.';
  return error?.message||'Une erreur est survenue. Réessayez.';
}
function showDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();}
function requireUser(){if(user)return true;showDialog('authDialog');return false;}
function status(text){$('connectionStatus').textContent=text;}
function empty(text){$('marketGrid').replaceChildren();$('marketEmpty').hidden=false;$('marketEmpty').querySelector('h3').textContent=text;$('resultCount').textContent='';}

// Decorative equipment illustration; listings always use their owners' photographs.
$('heroEquipment').innerHTML=`<svg viewBox="0 0 480 380" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="speaker" x2="1" y2="1"><stop stop-color="#3a4b43"/><stop offset="1" stop-color="#142920"/></linearGradient><pattern id="mesh" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#97aa92" opacity=".3"/></pattern></defs><ellipse cx="230" cy="333" rx="160" ry="19" fill="#4c5e3b" opacity=".12"/><g transform="translate(117 72) rotate(-9 90 120)"><rect x="27" y="-14" width="75" height="24" rx="10" fill="none" stroke="#253b2c" stroke-width="8"/><rect width="137" height="241" rx="18" fill="url(#speaker)"/><rect x="9" y="9" width="119" height="223" rx="12" fill="url(#mesh)"/><circle cx="68" cy="71" r="33" fill="#182d22" stroke="#5d7060" stroke-width="3"/><circle cx="68" cy="71" r="17" fill="#354b3c"/><circle cx="68" cy="166" r="47" fill="#15291f" stroke="#69816b" stroke-width="3"/><circle cx="68" cy="166" r="28" fill="#293f30" stroke="#344f3b" stroke-width="6"/><rect x="57" y="217" width="24" height="4" rx="2" fill="#d99865"/></g><g transform="translate(280 207) rotate(12)"><path d="M27 12l8-16h35l8 16" fill="#b6734b"/><rect y="7" width="114" height="77" rx="12" fill="#d59263"/><rect y="24" width="114" height="46" fill="#292f28"/><circle cx="61" cy="46" r="33" fill="#465342" stroke="#d6b48e" stroke-width="6"/><circle cx="61" cy="46" r="23" fill="#142821"/><circle cx="61" cy="46" r="13" fill="#385946"/><circle cx="55" cy="39" r="5" fill="#a6c0a4"/><rect x="10" y="13" width="15" height="8" rx="2" fill="#f7e4c4"/></g><path d="M328 71c-6 23 15 39 39 28" fill="none" stroke="#b2bf9e" stroke-width="3"/><path d="M340 78c-2 9 4 15 14 13" fill="none" stroke="#b2bf9e" stroke-width="3"/></svg>`;

for(const [id,label,icon] of [['all','Tout le matériel','⊞'],...categories]){
  const b=button(icon+'  '+label,'',()=>{filters.category=id;render();});b.dataset.category=id;b.setAttribute('aria-pressed',String(id==='all'));$('marketCategories').append(b);
}
for(const [id,label] of categories){const o=el('option','',label);o.value=id;$('draftCategory').append(o);}

async function load(){
  if(!user)return;const revision=++generation;loading=true;status('Chargement des annonces…');
  try{
    const [rows,saved]=await Promise.all([store.listings(own,user.id),store.favorites()]);
    if(revision!==generation)return;
    const paths=[...new Set(rows.flatMap(item=>item.image_paths))];const urls=await store.imageUrls(paths);
    if(revision!==generation)return;
    items=rows;favorites=new Set(saved.map(f=>f.listing_id));photos=new Map(urls.filter(p=>p.signedUrl).map(p=>[p.path,p.signedUrl]));
    const currentCity=filters.city;$('marketCity').replaceChildren(new Option('Toutes les villes',''));
    [...new Set(rows.map(i=>i.city))].sort((a,b)=>a.localeCompare(b,'fr')).forEach(city=>$('marketCity').append(new Option(city,city)));
    if([...$('marketCity').options].some(o=>o.value===currentCity))$('marketCity').value=currentCity;else filters.city='';
    status('Entre membres MyEvent · Vente et location · Contact direct, sans paiement en ligne');render();
  }catch(error){if(revision===generation){status(errorMessage(error));empty('Les annonces ne sont pas disponibles');}}
  finally{if(revision===generation)loading=false;}
}
function render(){
  $('marketCategories').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===filters.category)));
  root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===filters.mode)));
  $('favoritesButton').setAttribute('aria-pressed',String(onlyFavorites));$('myListings').setAttribute('aria-pressed',String(own));$('favoriteCount').textContent=favorites.size;
  if(!user){
    empty('Bienvenue dans la marketplace MyEvent');
    $('marketEmpty').querySelector('p').textContent='Connectez-vous pour consulter les annonces ou proposer votre matériel.';
    $('marketGrid').append(button('Se connecter','primary',()=>showDialog('authDialog')));return;
  }
  $('catalogueTitle').textContent=own?'Mes annonces':onlyFavorites?'Mes équipements favoris':'À découvrir pour vos événements';
  const rows=filterListings(items,{...filters,favorites:onlyFavorites?favorites:null});
  $('resultCount').textContent=rows.length+' annonce'+(rows.length>1?'s':'');$('marketGrid').replaceChildren();$('marketEmpty').hidden=!!rows.length;
  $('marketEmpty').querySelector('h3').textContent=items.length?'Aucun matériel ne correspond':'Les premières annonces vous attendent';
  $('marketEmpty').querySelector('p').textContent=items.length?'Essayez une autre recherche ou réinitialisez les filtres.':'Déposez une annonce pour vendre ou louer votre matériel événementiel.';
  for(const item of rows){
    const card=el('article','productCard'),visual=el('div','productVisual');
    const url=photos.get(item.image_paths[0]);
    if(url){const image=el('img','productPhoto');image.src=url;image.alt=item.title;image.loading='lazy';visual.append(image);}
    else visual.append(el('span','photoPlaceholder','Photo indisponible'));
    const open=button('','openProduct',()=>openDetail(item));open.setAttribute('aria-label','Voir '+item.title);visual.append(open);
    visual.append(el('span','productBadge',item.status==='draft'?'Brouillon':item.status==='archived'?'Retirée':item.mode==='rent'?'À louer':'À vendre'));
    const save=button(favorites.has(item.id)?'♥':'♡','saveProduct',()=>toggleFavorite(item,save));save.setAttribute('aria-label','Favori : '+item.title);save.setAttribute('aria-pressed',String(favorites.has(item.id)));visual.append(save);
    const title=el('h3');title.append(button(item.title,'titleButton',()=>openDetail(item)));
    const bottom=el('div','productFooter'),price=el('span','price',money(item.price_cents));if(item.mode==='rent')price.append(el('small','',' / jour'));bottom.append(price,el('span','city','⌖ '+item.city));
    card.append(visual,el('p','productCategory',labelCategory(item.category)),title,bottom);$('marketGrid').append(card);
  }
}
async function toggleFavorite(item,b){
  if(!requireUser())return;if(item.status!=='active'){toast('Seules les annonces publiées peuvent être ajoutées aux favoris.');return;}
  b.disabled=true;const save=!favorites.has(item.id);
  try{await store.favorite(item.id,user.id,save);if(save)favorites.add(item.id);else favorites.delete(item.id);render();}catch(error){toast(errorMessage(error));}finally{b.disabled=false;}
}
function openDetail(item){
  const host=$('listingDetail');host.replaceChildren();
  const gallery=el('div','detailGallery');for(const path of item.image_paths){const src=photos.get(path);if(src){const img=el('img');img.src=src;img.alt=item.title;gallery.append(img);}}
  const title=el('h2','',item.title);title.id='detailTitle';
  const price=el('p','price',money(item.price_cents));if(item.mode==='rent')price.append(el('small','',' / jour'));
  const facts=el('div','detailFacts');[labelCategory(item.category),conditions[item.condition],item.city].forEach(text=>facts.append(el('span','',text)));
  host.append(gallery,el('p','eyebrow',item.mode==='rent'?'À LOUER':'À VENDRE'),title,price,facts,el('p','detailDescription',item.description));
  if(item.owner_id===user?.id){
    host.append(button('Modifier l’annonce','primary',()=>{$('listingDialog').close();openForm(item);}));
    if(item.status!=='archived')host.append(button('Retirer l’annonce','quiet',async()=>{try{await store.update(item.id,{status:'archived'});$('listingDialog').close();await load();toast('Annonce retirée. Vos conversations sont conservées.');}catch(e){toast(errorMessage(e));}}));
  }else{
    const contact=button('Contacter le propriétaire','primary',async()=>{
      if(!requireUser())return;contact.disabled=true;
      try{const id=await store.contact(item.id);$('listingDialog').close();await openInbox(id);}catch(e){toast(errorMessage(e));}finally{contact.disabled=false;}
    });host.append(contact);
  }
  host.append(el('p','detailNotice',item.mode==='rent'?'Contactez le propriétaire pour les dates, la caution éventuelle et la remise du matériel. Aucun créneau n’est réservé et aucun paiement n’est encaissé sur MyEvent.':'Échangez avec le vendeur pour la remise du matériel et le règlement. Aucun paiement n’est encaissé sur MyEvent.'));showDialog('listingDialog');
}
function openForm(item=null){
  if(!requireUser())return;editing=item;$('draftForm').reset();$('draftStatus').textContent='';$('draftTitle').textContent=item?'Modifier mon annonce':'Déposer une annonce';
  if(item){for(const name of ['title','description','mode','category','city','condition'])$('draftForm').elements[name].value=item[name];$('draftForm').elements.price.value=item.price_cents/100;}
  $('draftForm').elements.photos.required=!item?.image_paths?.length;
  $('draftForm').querySelector('button[type=submit]').textContent=item?'Enregistrer et publier':'Publier mon annonce';updateUnit();showDialog('draftDialog');
}
function updateUnit(){$('draftPriceUnit').textContent=$('draftForm').elements.mode.value==='rent'?'Par jour de location':'Prix de vente total';}
async function jpeg(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choisissez une photo JPEG, PNG ou WebP de moins de 10 Mo.');
  const image=new Image(),url=URL.createObjectURL(file);
  try{
    image.src=url;await image.decode();const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));canvas.width=canvas.height=0;
    if(!blob||blob.size>5*1024*1024)throw new Error('Impossible de préparer cette photo. Essayez une autre image.');return blob;
  }finally{URL.revokeObjectURL(url);}
}
$('draftForm').addEventListener('submit',async e=>{
  e.preventDefault();if(formBusy||!requireUser())return;const form=e.currentTarget,submit=form.querySelector('button[type=submit]');
  let newPaths=[],publicationAttempted=false;formBusy=true;submit.disabled=true;
  try{
    const fields=validateListing(Object.fromEntries(new FormData(form))),files=[...form.elements.photos.files];
    if(files.length>4||(!files.length&&!editing?.image_paths?.length))throw new Error('Ajoutez entre 1 et 4 photos.');
    $('draftStatus').textContent='Préparation des photos…';const blobs=[];for(const file of files)blobs.push(await jpeg(file));
    if(!editing)editing=await store.create({...fields,owner_id:user.id});
    const previousPaths=editing.image_paths||[];
    for(const [i,blob] of blobs.entries()){
      $('draftStatus').textContent=`Envoi de la photo ${i+1}/${blobs.length}…`;
      const path=user.id+'/'+editing.id+'/'+crypto.randomUUID()+'.jpg';await store.upload(path,blob);newPaths.push(path);
    }
    publicationAttempted=true;
    editing=await store.update(editing.id,{...fields,image_paths:newPaths.length?newPaths:previousPaths,status:'active'});
    // Remove superseded images only after the updated listing is confirmed persisted.
    if(newPaths.length&&previousPaths.length)store.removeImages(previousPaths).catch(()=>{});
    $('draftDialog').close();toast('Votre annonce est publiée.');own=true;onlyFavorites=false;await load();
  }catch(error){
    if(!publicationAttempted)await store.removeImages(newPaths).catch(()=>{});
    $('draftStatus').textContent=errorMessage(error)+(editing?' Retrouvez aussi votre annonce dans « Mes annonces ».':'');
  }finally{formBusy=false;submit.disabled=false;}
});
$('draftDialog').addEventListener('cancel',e=>{if(formBusy)e.preventDefault();});

async function openInbox(id=null){
  if(!requireUser())return;showDialog('inboxDialog');$('messageStatus').textContent='';
  try{
    const rows=await store.threads();$('threadList').replaceChildren();
    for(const row of rows)$('threadList').append(button(row.listing_title+' · '+(row.seller_id===user.id?'Demande reçue':'Votre demande'),'threadButton',()=>openThread(row)));
    if(!rows.length)$('threadList').append(el('p','','Vos échanges avec les membres apparaîtront ici.'));
    const selected=rows.find(t=>t.id===(id||thread?.id));if(selected)await openThread(selected);
  }catch(e){$('messageStatus').textContent=errorMessage(e);toast(errorMessage(e));}
}
async function openThread(row){if(thread?.id!==row.id){$('messageForm').reset();$('messageStatus').textContent='';}thread=row;threadRevision++;$('conversation').hidden=false;$('conversationTitle').textContent=row.listing_title;await refreshMessages();}
async function refreshMessages(){
  clearTimeout(messageTimer);if(!thread||!$('inboxDialog').open||!user)return;const revision=threadRevision,id=thread.id;
  try{
    const rows=await store.messages(id);if(revision!==threadRevision||!$('inboxDialog').open)return;
    const list=$('messageList'),nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<60;list.replaceChildren();
    for(const message of rows){const bubble=el('div','messageBubble'+(message.sender_id===user.id?' mine':''));bubble.append(el('p','',message.body),el('small','',new Date(message.created_at).toLocaleString('fr-FR')));list.append(bubble);}
    if(!rows.length)list.append(el('p','','Commencez la conversation : dates souhaitées, disponibilité, remise du matériel…'));
    if(nearBottom)list.scrollTop=list.scrollHeight;
  }catch(e){$('messageStatus').textContent=errorMessage(e);}
  finally{if(revision===threadRevision&&$('inboxDialog').open)messageTimer=setTimeout(refreshMessages,10000);}
}
let pendingMessage=null;
$('messageForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!thread||!user)return;const form=e.currentTarget,body=form.elements.body.value.trim(),submit=form.querySelector('button');
  if(!body||body.length>2000)return;submit.disabled=true;const id=thread.id;
  if(pendingMessage?.thread!==id||pendingMessage?.body!==body)pendingMessage={thread:id,body,id:crypto.randomUUID()};
  try{await store.send(id,user.id,body,pendingMessage.id);if(thread?.id===id)form.reset();pendingMessage=null;$('messageStatus').textContent='Message envoyé.';await refreshMessages();}
  catch(e){if(e.code==='23505'){form.reset();pendingMessage=null;$('messageStatus').textContent='Message déjà envoyé.';await refreshMessages();}else $('messageStatus').textContent=errorMessage(e);}
  finally{submit.disabled=false;}
});
$('inboxDialog').addEventListener('close',()=>{clearTimeout(messageTimer);threadRevision++;});
$('refreshInbox').addEventListener('click',()=>openInbox());
$('inboxButton').addEventListener('click',()=>openInbox());
$('createListing').addEventListener('click',()=>openForm());$('createListingBottom').addEventListener('click',()=>openForm());
$('draftForm').elements.mode.addEventListener('change',updateUnit);
root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.close==='draftDialog'&&formBusy)return;$(b.dataset.close).close();}));
root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{filters.mode=b.dataset.mode;render();}));
$('marketSearch').addEventListener('input',e=>{filters.query=e.target.value;render();});
$('marketCity').addEventListener('change',e=>{filters.city=e.target.value;render();});
$('marketSort').addEventListener('change',e=>{filters.sort=e.target.value;render();});
$('searchButton').addEventListener('click',()=>{if(!requireUser())return;if(!items.length&&!loading)load();else render();$('catalogueTitle').scrollIntoView({behavior:'smooth',block:'start'});});
$('clearFilters').addEventListener('click',()=>{Object.assign(filters,{mode:'all',category:'all',query:'',city:'',sort:'featured'});$('marketSearch').value='';$('marketCity').value='';$('marketSort').value='featured';onlyFavorites=false;if(requireUser())load();});
$('favoritesButton').addEventListener('click',()=>{if(!requireUser())return;onlyFavorites=!onlyFavorites;own=false;load();});
$('myListings').addEventListener('click',()=>{if(!requireUser())return;own=!own;onlyFavorites=false;load();});
$('marketLogin').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,b=form.querySelector('button');b.disabled=true;$('authStatus').textContent='Connexion…';
  try{if(!client)throw new Error('Service indisponible. Rechargez la page.');const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(error)throw error;form.reset();$('authDialog').close();}
  catch(error){$('authStatus').textContent=errorMessage(error);}finally{b.disabled=false;}
});
function signedOut(){
  generation++;threadRevision++;clearTimeout(messageTimer);user=null;items=[];photos.clear();favorites.clear();thread=null;editing=null;pendingMessage=null;onlyFavorites=own=false;
  for(const dialog of root.querySelectorAll('dialog[open]'))dialog.close();$('messageList').replaceChildren();$('threadList').replaceChildren();$('conversation').hidden=true;$('draftForm').reset();render();
  status('Connectez-vous à votre compte MyEvent pour accéder aux annonces.');
}
try{
  if(!window.supabase)throw new Error('Le service de connexion n’a pas pu être chargé. Rechargez la page.');
  client=window.supabase.createClient(projectUrl,publishableKey);store=createMarketplaceStore(client);
  client.auth.onAuthStateChange((_event,session)=>{
    // Schedule work outside the auth callback (avoid SDK auth-lock deadlocks).
    setTimeout(()=>{const next=session?.user;if(!next){signedOut();return;}if(user?.id!==next.id){user=next;load();}},0);
  });
}catch(error){status(errorMessage(error));empty('Connexion indisponible');}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(messageTimer);else if($('inboxDialog').open)refreshMessages();});
