import {normalizeSettings,AUTOMATIC_ADS_RELEASE_APPROVED} from './automatic-ads-policy.mjs';
const target=document.getElementById('orevamiAutomaticAdsAdmin');
let epoch=0;
function node(tag,text){const el=document.createElement(tag);if(text)el.textContent=text;return el;}
async function load(){
 if(!target||typeof sb==='undefined')return;const seq=++epoch;
 target.replaceChildren();
 try{
  const check=await sb.rpc('myevent_is_admin');if(check.error||check.data!==true||seq!==epoch)return;
  const result=await sb.from('automatic_ad_settings').select('*').eq('id',true).single();if(seq!==epoch)return;
  target.append(node('h3','Publicité automatique · AdSense'),node('p','Chargement de régie interdit dans ce document privé. Validation d’une surface publique séparée requise.'));
  if(result.error){target.append(node('p','Configuration indisponible. Schéma V1 à installer dans TEST ; annonces désactivées.'));return;}
  const c=normalizeSettings(result.data),form=node('form'),message=node('p');message.setAttribute('role','status');
  const status=!c.publisher_id||!c.slot_id?'Non configurée':!c.approved?'Approbation Google à confirmer':'Identifiants renseignés · connexion non vérifiée';
  target.append(node('p',status+' · '+(AUTOMATIC_ADS_RELEASE_APPROVED?'Verrou de livraison levé':'Verrou de livraison actif : aucune annonce réelle')));
  const fields=[['enabled','Autoriser la diffusion future (verrouillée)','checkbox'],['feed_enabled','Emplacement : fil d’accueil','checkbox'],['spacing','Publications entre annonces (5–30)','number'],['max_slots','Maximum dans le fil (0–2, Sponsorisé compris)','number'],['publisher_id','Identifiant éditeur AdSense','text'],['slot_id','Identifiant du bloc responsive','text'],['cmp_id','Identifiant de la CMP certifiée Google','number'],['approved','Approbation du site confirmée dans AdSense','checkbox']];
  for(const [key,label,type] of fields){const line=node('label',label+' '),input=node('input');input.name=key;input.type=type;if(type==='checkbox')input.checked=c[key];else input.value=c[key];if(type==='number'){input.step='1';const limits={spacing:[5,30],max_slots:[0,2],cmp_id:[0,65535]}[key];input.min=limits[0];input.max=limits[1];input.required=true;}line.append(input);form.append(line);}
  const save=node('button','Enregistrer'),kill=node('button','Suspendre immédiatement');save.type='submit';kill.type='button';form.append(save,kill,message);target.append(form);
  const report=node('a','Ouvrir les rapports officiels AdSense');report.href='https://adsense.google.com/';report.target='_blank';report.rel='noopener noreferrer';target.append(report,node('p','Aucune statistique ni revenu synchronisé. Les déclarations Sponsorisé restent séparées.'));
  async function update(payload){save.disabled=kill.disabled=true;
   try{const r=await sb.from('automatic_ad_settings').update(payload).eq('id',true).select('id');if(r.error||r.data?.length!==1)throw Error('Enregistrement refusé.');window.orevamiAutomaticAds?.refresh();message.textContent='Réglages enregistrés. Diffusion bloquée dans le document privé.';}
   catch{message.textContent='Enregistrement impossible ou accès refusé.';}finally{save.disabled=kill.disabled=false;}
  }
  form.onsubmit=e=>{e.preventDefault();const data={};for(const [key,,type] of fields)data[key]=type==='checkbox'?form.elements[key].checked:type==='number'?Number(form.elements[key].value):form.elements[key].value.trim();
   if(data.publisher_id&&!/^ca-pub-\d{16}$/.test(data.publisher_id)||data.slot_id&&!/^\d{10}$/.test(data.slot_id)){message.textContent='Identifiant publicitaire invalide.';return;}update(normalizeSettings(data));};
  kill.onclick=()=>{window.orevamiAutomaticAds?.suspend();form.elements.enabled.checked=false;update({enabled:false});};
 }catch{if(seq===epoch)target.replaceChildren(node('p','Publicité automatique indisponible.'))}
}
const tab=document.querySelector('[data-admin-tab="settings"]');tab?.addEventListener('click',load);
const ready=setInterval(()=>{if(typeof sb==='undefined')return;clearInterval(ready);sb.auth.onAuthStateChange(()=>{epoch++;target?.replaceChildren();});},500);
