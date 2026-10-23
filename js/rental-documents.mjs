import {pdfBlocks,createRentalPDF} from './rental-pdf.mjs';
// Paper documents only: no persistence, reservation, payment or backend call.
export const notice = 'Modèles pour la location de matériel en France, à adapter à votre situation. Ils ne garantissent pas une validité juridique universelle. MyEvent ne conclut pas la location, ne propose pas d’assurance et ne reçoit ni loyer ni dépôt de garantie.';
export const fields = [
  ['reference','Référence du dossier'], ['owner','Propriétaire : nom / raison sociale'], ['ownerAddress','Adresse du propriétaire'], ['ownerContact','Téléphone / email du propriétaire'],
  ['ownerStatus','Statut du propriétaire','select',['Particulier','Professionnel']], ['ownerBusiness','Professionnel : SIREN / SIRET et représentant'],
  ['renter','Locataire : nom / raison sociale'], ['renterAddress','Adresse du locataire'], ['renterContact','Téléphone / email du locataire'],
  ['equipment','Matériel et accessoires inclus','textarea'], ['serial','Numéros de série / références et quantités'], ['use','Usage autorisé'],
  ['start','Début de location','datetime-local'], ['end','Fin de location','datetime-local'], ['handover','Lieu et modalités de remise / retour','textarea'],
  ['daily','Prix indicatif par jour (€)','number'], ['total','Prix total convenu (€ TTC si applicable)','number'], ['priceTerms','Détail du prix, frais, taxes et règlement direct','textarea'],
  ['deposit','Dépôt de garantie convenu (€)','number'], ['depositMode','Mode de remise directe au propriétaire','select',['À convenir','Espèces','Chèque non encaissé','Chèque encaissé','Virement direct','Autre']],
  ['depositDetails','Précisions sur la remise (sans coordonnées bancaires)'], ['received','Montant effectivement remis (€)','number'], ['receivedAt','Date de remise effective','datetime-local'],
  ['receiptStatus','Remise effective','select',['Non confirmée — projet de reçu','Confirmée par le propriétaire sur papier']],
  ['returnBy','Date limite convenue de restitution du dépôt','date'], ['returnTerms','Conditions et mode de restitution du dépôt','textarea'],
  ['terms','Conditions de location / annulation / retard','textarea'], ['consumerTerms','Si propriétaire professionnel : informations précontractuelles, médiateur, rétractation et annexes applicables','textarea'],
  ['outAt','Date du constat de départ','datetime-local'], ['outState','État au départ : fonctionnement, défauts, accessoires, quantités','textarea'],
  ['backAt','Date du constat de retour','datetime-local'], ['backState','État au retour : fonctionnement, défauts, accessoires, quantités','textarea'],
  ['evidence','Références des photos / annexes (à joindre séparément)'], ['disagreements','Réserves et désaccords des deux parties','textarea'],
  ['deductions','Retenues proposées : motifs, montants et justificatifs','textarea'], ['returned','Montant du dépôt restitué (€)','number'], ['returnedAt','Date de restitution effective','date'],
  ['observations','Observations communes','textarea'], ['place','Lieu de signature'], ['signedAt','Date de signature','date']
];
export function prefillRental(item){
  return Object.fromEntries(fields.map(([key])=>[key,({reference:'Location '+(item.id||''),equipment:[item.title,item.description].filter(Boolean).join('\n'),serial:'Quantité et références à confirmer',handover:item.city||'',daily:Number.isFinite(item.price_cents)?(item.price_cents/100).toFixed(2):'',ownerStatus:'Particulier',depositMode:'À convenir',receiptStatus:'Non confirmée — projet de reçu',returnTerms:'Après vérification contradictoire au retour : restituer le dépôt selon le délai et le mode convenus. Toute retenue doit être motivée et documentée, en tenant compte de l’usure normale et des règles applicables.',outState:item.condition? 'État indiqué dans l’annonce : '+({good:'Bon état',like_new:'Comme neuf',used:'État d’usage',new:'Neuf'}[item.condition]||item.condition)+' — à vérifier ensemble.':'',terms:'Le propriétaire remet un matériel adapté à l’usage convenu et les consignes nécessaires. Le locataire utilise le matériel conformément aux consignes et le restitue avec ses accessoires. Les défauts, réserves et éventuelles retenues sont consignés contradictoirement.',})[key]??'']));
}
export function validateRental(data,kind){
  const errors=[];
  for(const key of ['owner','ownerAddress','renter','renterAddress','equipment','start','end','total','place','signedAt'])if(!String(data[key]??'').trim())errors.push('À compléter : '+fields.find(f=>f[0]===key)[1]);
  for(const [key,label,type] of fields)if(type==='number'&&data[key]!==''&&data[key]!=null&&(!Number.isFinite(Number(data[key]))||Number(data[key])<0))errors.push(label+' : montant positif ou nul requis.');
  if(data.start&&data.end&&data.end<=data.start)errors.push('La fin doit être postérieure au début.');
  if(data.deposit!==''&&Number(data.deposit)>0)for(const key of ['depositMode','returnBy','returnTerms'])if(!data[key]||data[key]==='À convenir')errors.push('À compléter : '+fields.find(f=>f[0]===key)[1]);
  if(data.returnBy&&data.end&&data.returnBy<data.end.slice(0,10))errors.push('La restitution du dépôt ne peut être prévue avant la fin de location.');
  if(kind==='receipt')for(const key of ['deposit','depositMode','returnBy','returnTerms'])if(!data[key]||data[key]==='À convenir')errors.push('À compléter : '+fields.find(f=>f[0]===key)[1]);
  if(kind==='receipt'&&data.receiptStatus==='Confirmée par le propriétaire sur papier'){
    for(const key of ['received','receivedAt'])if(String(data[key]??'')==='')errors.push('À compléter : '+fields.find(f=>f[0]===key)[1]);
    if(Number(data.received)>Number(data.deposit))errors.push('Le montant remis dépasse le dépôt convenu : corrigez le dossier.');
  }
  if(kind==='inventory'&&(!data.outAt||!data.outState))errors.push('Complétez la date et le constat de départ.');
  if(data.backAt&&data.outAt&&data.backAt<data.outAt)errors.push('Le retour ne peut précéder le constat de départ.');
  if(data.ownerStatus==='Professionnel'&&(!data.ownerBusiness||!data.consumerTerms))errors.push('Complétez les mentions professionnelles et les informations consommateur applicables.');
  return errors;
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={contract:'Contrat de location de matériel',receipt:'Reçu de dépôt de garantie — remise directe au propriétaire',inventory:'État contradictoire du matériel — départ et retour'};
export const printCSS=`@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px/1.5 Arial,sans-serif;color:#18251f;background:white;margin:0}h1{font-size:24px;line-height:1.2}h2{font-size:16px;border-bottom:1px solid #b8c5bb;padding-bottom:5px;margin-top:22px}p{white-space:pre-wrap;overflow-wrap:anywhere}section{break-inside:auto}.entry{break-inside:avoid;margin:8px 0}.label{font-weight:bold}.note{font-size:11px;background:#f1f4ef;padding:12px}.signatures{display:flex;gap:24px;break-inside:avoid;margin-top:22px}.signatures p{flex:1;min-height:110px;border:1px solid #b8c5bb;padding:10px}header{border-bottom:3px solid #537259}footer{font-size:10px;margin-top:24px}@media screen{body{max-width:800px;margin:24px auto;padding:24px}}`;
export function renderRental(data,kind){
  if(!titles[kind])throw Error('Document inconnu');
  const entry=key=>{const label=fields.find(f=>f[0]===key)[1];let value=data[key];if(value&&fields.find(f=>f[0]===key)[2]==='number')value=Number(value).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';return '<div class="entry"><span class="label">'+escape(label)+'</span><p>'+escape(value||'À compléter sur papier : ____________________')+'</p></div>';};
  const section=(title,keys)=>'<section><h2>'+title+'</h2>'+keys.map(entry).join('')+'</section>';
  const errors=validateRental(data,kind);
  let html='<header><p>MyEvent · Documents de location · '+escape(data.reference)+'</p><h1>'+titles[kind]+'</h1></header><p class="note">'+escape(notice)+'</p>';
  if(errors.length)html+='<p class="note">BROUILLON — informations à compléter avant signature :\n'+escape(errors.join('\n'))+'</p>';
  html+=section('Les parties',['owner','ownerAddress','ownerContact','ownerStatus','ownerBusiness','renter','renterAddress','renterContact'])+section('Matériel et période',['equipment','serial','use','start','end','handover']);
  if(kind==='contract')html+=section('Prix et conditions',['daily','total','priceTerms','deposit','depositMode','depositDetails','returnBy','returnTerms','terms','consumerTerms']);
  if(kind==='receipt')html+='<p class="note">'+(data.receiptStatus==='Confirmée par le propriétaire sur papier'?'Le propriétaire soussigné reconnaît avoir reçu directement le montant indiqué ci-dessous, sous réserve de sa signature manuscrite. Un chèque remis non encaissé ne constitue pas un encaissement.':'PROJET DE REÇU — aucune remise de fonds n’est attestée. À compléter et signer par le propriétaire après remise effective.')+'</p>'+section('Remise et restitution',['receiptStatus','deposit','received','depositMode','depositDetails','receivedAt','returnBy','returnTerms','deductions','returned','returnedAt']);
  if(kind==='inventory')html+='<p>Les deux parties vérifient ensemble le matériel et consignent leurs constatations et réserves. Un champ de retour vide ne vaut pas acceptation du retour.</p>'+section('Constat au départ',['outAt','outState','evidence'])+'<div class="signatures"><p>Départ — signature manuscrite du propriétaire</p><p>Départ — signature manuscrite du locataire</p></div>'+section('Constat au retour',['backAt','backState','disagreements','deductions','returned','returnedAt'])+'<div class="signatures"><p>Retour — signature manuscrite du propriétaire</p><p>Retour — signature manuscrite du locataire</p></div>';
  html+=section('Observations et signature',['observations','place','signedAt'])+'<p>Établi en deux originaux, un remis à chacune des parties. Annexer le contrat, le reçu et les constats correspondants, ainsi que les photos et justificatifs mentionnés.</p>';
  if(kind!=='inventory')html+='<div class="signatures"><p>Signature manuscrite du propriétaire</p><p>Signature manuscrite du locataire</p></div>';
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>'+titles[kind]+'</title><style>'+printCSS+'</style></head><body>'+html+'<footer>Document préparé pour signature sur papier. Aucun paiement, encaissement, assurance ou signature électronique MyEvent.</footer></body></html>';
}
export function openRentalDocuments(item){
  const data=prefillRental(item),dialog=document.createElement('dialog');dialog.className='rentalDialog';dialog.setAttribute('aria-labelledby','rentalTitle');
  dialog.innerHTML='<button type="button" class="dialogClose" aria-label="Fermer le dossier">×</button><p class="eyebrow">LOCATION · DOCUMENTS À SIGNER SUR PAPIER</p><h2 id="rentalTitle">Préparer ma location</h2><p class="rentalNotice"></p><p>Les informations de l’annonce sont indicatives. Confirmez les identités, les dates et le prix total avec l’autre partie. La préparation du dossier ne réserve pas le matériel. Vos saisies restent dans cette fenêtre et seront effacées à sa fermeture.</p><form class="rentalForm"></form><div class="rentalActions"><label>Document<select id="rentalKind"><option value="contract">Contrat de location</option><option value="receipt">Reçu de dépôt de garantie</option><option value="inventory">État contradictoire du matériel</option></select></label><button type="button" class="primary" id="rentalPrint">Imprimer</button><button type="button" class="quiet" id="rentalPDF">Exporter en PDF</button></div><p>PDF : la fenêtre d’impression s’ouvre ; choisissez « Enregistrer au format PDF ». Imprimez ensuite deux originaux et signez-les sur papier.</p><p id="rentalStatus" role="status"></p><h3>Aperçu du document</h3><iframe title="Aperçu du document de location" sandbox="" class="rentalPreview"></iframe>';
  dialog.querySelector('.rentalNotice').textContent=notice;
  const form=dialog.querySelector('form'),kind=dialog.querySelector('select'),frame=dialog.querySelector('iframe'),status=dialog.querySelector('#rentalStatus');
  for(const [key,label,type='text',options] of fields){
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');input.name=key;
    if(type==='select')for(const text of options){const option=document.createElement('option');option.value=option.textContent=text;input.append(option);}
    else if(type==='textarea'){input.rows=3;input.maxLength=5000;}
    else{input.type=type;if(type==='number'){input.min='0';input.max='10000000';input.step='0.01';}else if(type==='text')input.maxLength=500;}
    input.value=data[key];wrapper.append(input);form.append(wrapper);
  }
  function update(){for(const [key] of fields)data[key]=form.elements[key].value;const errors=validateRental(data,kind.value);status.textContent=errors.length?errors.join(' · '):'Informations principales complétées. Relisez le document et ses annexes avant signature.';frame.srcdoc=renderRental(data,kind.value);}
  form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',e=>e.preventDefault());kind.addEventListener('change',update);
  function print(){update();if(!form.reportValidity())return;const errors=validateRental(data,kind.value);if(errors.length){status.textContent='Impression bloquée : '+errors.join(' · ');return;}const popup=window.open('','_blank');if(!popup){status.textContent='Autorisez l’ouverture de la fenêtre d’impression puis réessayez.';return;}popup.opener=null;popup.document.write(renderRental(data,kind.value));popup.document.close();popup.focus();popup.print();}
  dialog.querySelector('#rentalPrint').onclick=print;
  const pdfButton=dialog.querySelector('#rentalPDF');pdfButton.onclick=async()=>{
    update();if(!form.reportValidity())return;const errors=validateRental(data,kind.value);if(errors.length){status.textContent='Export bloqué : '+errors.join(' · ');return;}
    pdfButton.disabled=true;
    try{if(!window.PDFLib)throw Error('Bibliothèque PDF indisponible. Rechargez la page ou utilisez Imprimer.');const bytes=await createRentalPDF(pdfBlocks(renderRental(data,kind.value)),window.PDFLib),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download='myevent-location-'+kind.value+'.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='PDF préparé. Vérifiez le téléchargement et imprimez deux originaux pour les signatures manuscrites.';}
    catch(error){status.textContent=error.message;}finally{pdfButton.disabled=false;}
  };
  pdfButton.parentElement.nextElementSibling.textContent='Le PDF se télécharge directement. Imprimez deux originaux et signez-les sur papier. Le bouton Imprimer ouvre la fenêtre d’impression de votre navigateur.';
  dialog.querySelector('.dialogClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();},{once:true});
  document.getElementById('myeventMarketplace').append(dialog);update();dialog.showModal();
}
