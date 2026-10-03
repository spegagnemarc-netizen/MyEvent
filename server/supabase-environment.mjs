// Server-only environment boundary. No environment object is ever serialized.
const protectedProject='nxxvadbliinhvkirqkkl';
export function supabaseEnvironment(env=process.env){
 const environment=env.VERCEL_ENV||env.MYEVENT_ENV||'development';
 if(!['development','preview','production'].includes(environment))throw Error('Environnement MyEvent invalide.');
 const url=String(env.SUPABASE_URL||'').trim();
 const publishableKey=String(env.SUPABASE_PUBLISHABLE_KEY||'').trim();
 let parsed;try{parsed=new URL(url);}catch{throw Error('Configuration Supabase absente ou invalide.');}
 const cloud=parsed.protocol==='https:'&&/^[a-z0-9]{20}\.supabase\.co$/.test(parsed.hostname);
 const local=environment==='development'&&parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname)&&parsed.port==='54321';
 if((!cloud&&!local)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw Error('URL Supabase non autorisée.');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))throw Error('Une clé publique Supabase publishable est requise.');
 const projectRef=cloud?parsed.hostname.split('.')[0]:'local';
 const isTest=environment!=='production';
 if(isTest){
  if(projectRef===protectedProject)throw Error('La base actuelle est interdite en développement et Preview.');
  if(String(env.MYEVENT_TEST_SUPABASE_REF||'')!==projectRef)throw Error('Projet de test non confirmé.');
 }
 return Object.freeze({environment,isTest,projectRef,url:parsed.origin,publishableKey,
  authStorageKey:isTest?`myevent-test-${environment}-${projectRef}-auth`: `sb-${projectRef}-auth-token`});
}
