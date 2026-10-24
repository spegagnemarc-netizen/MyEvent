(function(){
 const form=document.getElementById('accountDeletionForm');if(!form)return;
 const status=document.getElementById('accountDeletionStatus'),submit=document.getElementById('accountDeletionSubmit'),confirm=form.elements.confirm;
 let client,session=null,configured=false,busy=false,done=false,epoch=0;
 function update(){submit.disabled=!configured||!session||!confirm.checked||busy||done;}
 function account(next){epoch++;session=next;done=false;confirm.checked=false;form.hidden=!session;status.textContent=session?(configured?'Vérifie les conséquences puis confirme ta demande.':'Le formulaire n’est pas encore activé. Aucune demande n’est transmise.'):'Connecte-toi à ORÉVAMI pour utiliser la demande sécurisée. Le canal e-mail reste accessible sans connexion.';update();}
 confirm.addEventListener('change',update);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled)return;
  const current=epoch,token=session.access_token;busy=true;update();status.textContent='Transmission de ta demande…';
  try{
   const response=await fetch('/api/account-deletion',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({confirmation:'SUPPRIMER MON COMPTE',requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(25000)});
   const data=await response.json();if(current!==epoch)return;
   if(response.status!==202||data.status!=='transmitted'||typeof data.reference!=='string')throw Error(data.error||'Transmission non confirmée.');
   done=true;status.textContent=data.message+' Référence : '+data.reference;
  }catch(error){if(current===epoch)status.textContent=error.name==='TimeoutError'?'Délai dépassé : transmission non confirmée. Une nouvelle tentative peut créer un doublon.':error.message||'Transmission non confirmée.';}
  finally{busy=false;update();}
 });
 (async()=>{
  try{
   const response=await fetch('/api/account-deletion',{cache:'no-store',credentials:'same-origin'});
   const state=await response.json();configured=response.ok&&state.requestChannelConfigured===true;
   if(!configured){status.textContent='Le formulaire de demande n’est pas encore activé. Aucune demande n’est transmise. Le canal e-mail reste accessible ci-dessous.';update();return;}
   const config=await window.myeventRuntime.ready;
   client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:config.authStorageKey}});
   client.auth.onAuthStateChange((_event,next)=>account(next));
   const result=await client.auth.getSession();if(result.error)throw result.error;account(result.data.session);
  }catch{status.textContent='Le formulaire sécurisé est indisponible. Aucune transmission n’a été confirmée. Le canal e-mail reste accessible ci-dessous.';update();}
 })();
})();
