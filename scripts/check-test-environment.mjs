// Read-only deployment verification. No auth credentials, writes or SQL.
export function checkConfig(c,expected){
 if(!/^[a-z0-9]{20}$/.test(expected)||expected==='nxxvadbliinhvkirqkkl')throw Error('Référence de test invalide.');
 if(c.environment!=='preview'||!c.isTest||c.projectRef!==expected||c.url!==`https://${expected}.supabase.co`||
 c.authStorageKey!==`myevent-test-preview-${expected}-auth`||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publishableKey))throw Error('Preview non isolée ou non configurée.');
 const fields=Object.keys(c).sort().join(',');
 if(fields!=='authStorageKey,environment,isTest,projectRef,publishableKey,url')throw Error('Champs de configuration inattendus.');
 return {environment:c.environment,projectRef:c.projectRef,isolated:true};
}
if(process.argv[1]?.endsWith('/check-test-environment.mjs')){
 try{
  const [origin,expected]=process.argv.slice(2);const u=new URL(origin);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.vercel.app')||u.hostname==='my-event-eosin.vercel.app'||u.search||u.hash||u.username||u.password)throw Error('URL Preview requise.');
  const r=await fetch(new URL('/api/runtime-config',u),{cache:'no-store',redirect:'error'});
  if(!r.ok||!r.headers.get('cache-control')?.includes('no-store'))throw Error('Configuration indisponible ou cachée.');
  console.log(JSON.stringify(checkConfig(await r.json(),expected)));
 }catch{console.error('Validation refusée. Vérifier les variables de la Preview ; aucune écriture distante effectuée.');process.exitCode=1;}
}
