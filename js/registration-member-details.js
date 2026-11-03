/* Only the explicit public projection is loaded; no birth date or contact. */
(()=>{
let generation=0;
window.orevamiMemberDetails=async(host,id)=>{
 const ticket=++generation,ctx=window.myeventCameraContext?.(),account=ctx?.user?.id;
 if(!account)return;
 const current=()=>ticket===generation&&host.isConnected&&window.myeventCameraContext?.().user?.id===account;
 try{
  const config=await window.myeventRuntime.ready;if(!config.isTest)return;
  const {data,error}=await ctx.sb.rpc('registration_public_v1',{p_user:id});
  if(error||!data||!current())return;
  const details=document.createElement('div');
  if(data.bio){const text=document.createElement('p');text.textContent=data.bio;details.append(text);}
  if(data.interests?.length){const text=document.createElement('p');text.textContent=data.interests.join(' · ');details.append(text);}
  if(data.photo_path){
   const result=await ctx.sb.storage.from('registration-photos').createSignedUrl(data.photo_path,60);
   if(!current())return;
   if(!result.error){const img=document.createElement('img');img.src=result.data.signedUrl;img.alt='Photo partagée par le membre';img.width=100;details.append(img);}
  }
  if(current())host.append(details);
 }catch{/* Private profile or unavailable projection: keep the existing profile usable. */}
};
})();
