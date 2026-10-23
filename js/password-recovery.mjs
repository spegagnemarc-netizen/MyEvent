// Only the SDK verifies link credentials; never log or copy them to app storage.
export async function setupRecovery({document,client,location,history}){
 const form=document.getElementById('recoveryForm'),status=document.getElementById('recoveryStatus');
 let recovery=false,busy=false,recoveryUserId=null;
 const cleanLink=()=>history.replaceState(null,'',location.pathname);
 function clearRecovery(){recovery=false;recoveryUserId=null;form.hidden=true;form.reset();}
 function showRecovery(event,session){
  if(event==='PASSWORD_RECOVERY'&&session?.user?.id){recovery=true;recoveryUserId=session.user.id;form.hidden=false;status.textContent='Choisis ton nouveau mot de passe.';cleanLink();}
  if(event==='SIGNED_OUT'||(recovery&&session?.user?.id!==recoveryUserId)){
   clearRecovery();status.textContent='Session terminée ou modifiée. Demande un nouveau lien depuis la connexion.';
  }
 }
 // Register before getSession, which may initialize the SDK from the email link.
 client.auth.onAuthStateChange(showRecovery);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!recovery)return;
  const password=form.elements.password.value,confirmation=form.elements.confirmation.value;
  if(password.length<8||password!==confirmation){status.textContent='Les mots de passe doivent être identiques et contenir au moins 8 caractères.';return;}
  busy=true;form.querySelector('button').disabled=true;
  try{
   const {error}=await client.auth.updateUser({password});if(error)throw error;
   clearRecovery();
   const result=await client.auth.signOut({scope:'local'});
   status.textContent=result.error?'Mot de passe enregistré. La déconnexion n’a pas pu être confirmée : ferme cette fenêtre.':'Mot de passe enregistré. Tu peux te reconnecter à ORÉVAMI.';
  }catch{status.textContent='Le mot de passe n’a pas pu être enregistré. Réessaie ou demande un nouveau lien.';}
  finally{busy=false;form.querySelector('button').disabled=false;}
 });
 try{const {error}=await client.auth.getSession();if(error)throw error;if(!recovery)status.textContent='Ce lien est absent, expiré ou déjà utilisé. Demande un nouveau lien depuis la connexion.';}
 catch{clearRecovery();status.textContent='Impossible de vérifier le lien. Demande un nouveau lien depuis la connexion.';}
 finally{cleanLink();}
}
if(typeof window!=='undefined'){
 try{const config=await window.myeventRuntime.ready;
  const client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:config.authStorageKey}});
  await setupRecovery({document:window.document,client,location:window.location,history:window.history});
 }catch{document.getElementById('recoveryStatus').textContent='Récupération indisponible : la connexion de cet environnement n’est pas configurée.';}
}
