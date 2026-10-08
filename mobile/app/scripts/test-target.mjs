export const TEST_REF='ahyyknfjsielnqyoxqgh';
export async function verifyTestTarget(raw,request=fetch){
 let url;try{url=new URL(raw);}catch{throw Error('Définissez EXPO_PUBLIC_MYEVENT_WEB_URL avec la Preview TEST accessible.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['/','/index.html'].includes(url.pathname))throw Error('URL TEST HTTPS vers l’accueil requise, sans jeton de contournement.');
 const configResponse=await request(new URL('/api/runtime-config',url),{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(configResponse.status!==200)throw Error('Preview inaccessible ou protégée : accès Vercel TEST à configurer.');
 let config;try{config=await configResponse.json();}catch{throw Error('Configuration TEST inaccessible (authentification Vercel possible).');}
 if(config.environment!=='preview'||config.isTest!==true||config.projectRef!==TEST_REF||config.url!==`https://${TEST_REF}.supabase.co`)throw Error('Cette cible n’est pas la Preview Supabase TEST autorisée.');
 const page=await request(new URL('/index.html',url),{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(page.status!==200||!(await page.text()).includes('href="explorer.html"'))throw Error('Le raccourci Explorer manque sur cette cible.');
 const explorer=await request(new URL('/explorer.html',url),{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(explorer.status!==200||!(await explorer.text()).includes('bookingForm'))throw Error('La page Explorer n’est pas disponible.');
 return url.href;
}
