import {randomUUID} from 'node:crypto';
import {supabaseEnvironment} from './supabase-environment.mjs';
const mailbox='contact@orevami.com';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email=/^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/;
export function mailConfigured(env){return env.ACCOUNT_DELETION_ENABLED==='true' && !!env.ACCOUNT_DELETION_SMTP_PASSWORD;}
async function deliver(message,env){
 const {default:nodemailer}=await import('nodemailer');
 const transport=nodemailer.createTransport({host:'smtp.mail.ovh.net',port:465,secure:true,
  auth:{user:mailbox,pass:env.ACCOUNT_DELETION_SMTP_PASSWORD},
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:10000,dnsTimeout:5000,
  logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true,maxRecipients:1});
 try{return await transport.sendMail(message);}finally{transport.close();}
}
// This endpoint only transmits a request. It never deletes a user or writes to the database.
export function createAccountDeletionHandler({env=process.env,fetcher=fetch,sendMail=deliver,runtime=supabaseEnvironment,now=Date.now}={}){
 const attempts=new Map();
 return async function accountDeletion(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET')return res.status(200).json({requestChannelConfigured:mailConfigured(env),automaticDeletion:false});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Méthode non autorisée.'});}
  const allowed=['https://orevami.com','https://www.orevami.com'];
  if(env.VERCEL_ENV==='preview'&&/^[a-z0-9.-]+\.vercel\.app$/.test(env.VERCEL_URL||''))allowed.push('https://'+env.VERCEL_URL);
  if(env.VERCEL_ENV!=='production'&&env.ACCOUNT_DELETION_TEST_ORIGIN==='http://127.0.0.1:8767')allowed.push(env.ACCOUNT_DELETION_TEST_ORIGIN);
  if(!allowed.includes(req.headers?.origin))return res.status(403).json({error:'Origine non autorisée.'});
  if(!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||''))return res.status(415).json({error:'Format JSON requis.'});
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['confirmation','requestId'].includes(k))||body.confirmation!=='SUPPRIMER MON COMPTE'||!uuid.test(body.requestId||''))return res.status(400).json({error:'Confirme la suppression de ton compte et de ses données.'});
  if(!mailConfigured(env))return res.status(503).json({error:'Le formulaire de demande n’est pas encore activé. Aucune transmission n’a été confirmée.'});
  const authorization=req.headers?.authorization;
  if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9_.-]{10,4096}$/.test(authorization))return res.status(401).json({error:'Reconnecte-toi à ton compte pour continuer.'});
  let config,user;
  try{
   config=runtime(env);
   const auth=await fetcher(config.url+'/auth/v1/user',{headers:{apikey:config.publishableKey,authorization},signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return res.status(auth.status>=500?503:401).json({error:'Connexion non vérifiée. Réessaie après reconnexion.'});
   user=await auth.json();
  }catch{return res.status(503).json({error:'Vérification du compte indisponible. Aucune transmission confirmée.'});}
  if(!uuid.test(user?.id||'')||!email.test(user?.email||'')||!user.email_confirmed_at)return res.status(401).json({error:'Un compte avec une adresse e-mail vérifiée est requis.'});
  const time=now();
  for(const [key,until]of attempts)if(until<=time)attempts.delete(key);
  if(attempts.has(user.id)){res.setHeader('Retry-After','60');return res.status(429).json({error:'Une demande vient d’être tentée. Attends une minute avant de réessayer.'});}
  if(attempts.size>=1000)return res.status(503).json({error:'Service occupé. Réessaie plus tard.'});
  attempts.set(user.id,time+60000);
  const reference=randomUUID();
  try{
   const result=await sendMail({from:{name:'ORÉVAMI — demandes de droits',address:mailbox},to:{address:mailbox},replyTo:{address:user.email},
    subject:'ORÉVAMI — demande de suppression '+reference,
    text:['Demande authentifiée de suppression du compte et des données associées.',
     'Référence serveur : '+reference,'Référence de tentative : '+body.requestId,'Réception serveur : '+new Date(time).toISOString(),
     'Compte vérifié : '+user.id,'Adresse du compte vérifiée : '+user.email,
     'Confirmation explicite : SUPPRIMER MON COMPTE',
     'Traitement manuel requis : accuser réception, vérifier si nécessaire, effacer selon la procédure validée et confirmer la clôture.',
     'Cette notification ne prouve pas que les données sont déjà supprimées.'].join('\n')},env);
   if(!Array.isArray(result?.accepted)||!result.accepted.some(value=>String(value).toLowerCase()===mailbox)||result.rejected?.length)throw Error('Unconfirmed handoff');
   return res.status(202).json({reference,status:'transmitted',automaticDeletion:false,
    message:'Ta demande a été acceptée par le serveur de messagerie pour transmission au responsable. Conserve cette référence. Le traitement reste manuel ; un accusé puis une confirmation de clôture te seront adressés.'});
  }catch{return res.status(502).json({error:'Transmission non confirmée. La demande n’est pas présentée comme reçue ou exécutée. Réessaie plus tard ; une nouvelle tentative peut créer un doublon.'});}
 };
}
export default createAccountDeletionHandler();
