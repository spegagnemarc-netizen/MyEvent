// Same configuration for the main app and standalone pages; no storage overrides.
(()=>{
 // Keep the same-origin Vercel Preview authentication cookie on this request.
 const ready=fetch('/api/runtime-config',{cache:'no-store',credentials:'same-origin'}).then(async response=>{
  const value=await response.json();
  if(!response.ok)throw Error('Connexion désactivée : environnement Supabase non configuré.');
  if(!value||!['development','preview','production'].includes(value.environment)||
   typeof value.url!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$|^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(value.url)||
   !/^sb_publishable_[A-Za-z0-9_-]+$/.test(value.publishableKey)||
   value.isTest!==(value.environment!=='production')||typeof value.authStorageKey!=='string')throw Error('Configuration Supabase invalide.');
  if(value.isTest&&value.projectRef==='nxxvadbliinhvkirqkkl')throw Error('Base actuelle interdite sur cette Preview.');
  if(value.environment==='preview'&&(value.projectRef!=='ahyyknfjsielnqyoxqgh'||value.url!=='https://ahyyknfjsielnqyoxqgh.supabase.co'))throw Error('Projet Supabase de test requis sur cette Preview.');
  return Object.freeze(value);
 });
 window.myeventRuntime=Object.freeze({ready});
 function banner(text){
  const render=()=>{const el=document.createElement('div');el.id='myeventEnvironmentBanner';el.setAttribute('role','status');el.textContent=text;
   el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#ffdb70;color:#161a24;padding:8px 12px;font:600 12px system-ui;text-align:center;pointer-events:none;padding-top:calc(8px + env(safe-area-inset-top))';
   document.body.prepend(el);document.body.style.paddingTop='calc(38px + env(safe-area-inset-top))';
   const admin=document.getElementById('myeventAdminPanel');if(admin)admin.style.top='calc(38px + env(safe-area-inset-top))';};
  if(document.body)render();else document.addEventListener('DOMContentLoaded',render,{once:true});
 }
 ready.then(config=>{if(config.isTest)banner(`MYEVENT TEST · ${config.environment} · données fictives uniquement · ${config.projectRef}`);},()=>banner('MYEVENT · CONNEXION BLOQUÉE · configuration de test requise'));
})();
