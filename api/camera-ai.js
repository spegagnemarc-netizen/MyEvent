import {aiLenses} from '../js/camera-ai-presets.mjs';

export const config={api:{bodyParser:{sizeLimit:'4mb'}}};
export const maxDuration=180;
// Same public project as the application. Secrets stay in server environment variables.
const authUrl='https://nxxvadbliinhvkirqkkl.supabase.co/auth/v1/user';
const publicKey='sb_publishable_jBqcZF0k-mNBp5HJGxniTQ_gcjkPgMn';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
  const authorization=req.headers?.authorization;
  if(!/^Bearer \S+$/.test(authorization||''))return res.status(401).json({error:'Connecte-toi pour utiliser les filtres IA.'});
  const lens=aiLenses.find(x=>x.id===req.body?.lens);
  const imageData=req.body?.imageData;
  if(!lens)return res.status(400).json({error:'Filtre inconnu.'});
  if(typeof imageData!=='string'||imageData.length>3500000)return res.status(400).json({error:'Photo trop volumineuse ou invalide.'});
  const match=imageData.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)return res.status(400).json({error:'Une photo JPEG est nécessaire.'});
  const bytes=Buffer.from(match[1],'base64');
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)return res.status(400).json({error:'Photo JPEG invalide.'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Les filtres IA ne sont pas encore activés sur ce serveur.'});
  try{
    const auth=await fetch(authUrl,{headers:{authorization,apikey:publicKey},signal:AbortSignal.timeout(10000)});
    if(!auth.ok)return res.status(auth.status>=500?503:401).json({error:auth.status>=500?'Connexion indisponible. Réessaie.':'Ta session a expiré. Reconnecte-toi.'});
    const user=await auth.json();
    if(!user.id)return res.status(401).json({error:'Session invalide.'});
    const form=new FormData();
    form.append('model','gpt-image-2');
    form.append('prompt',lens.prompt+' Edit the supplied photo. Preserve the number of people, their identity, apparent age, skin tone, pose and the original framing and aspect ratio unless the requested style requires illustration. Keep clothing appropriate. Do not add text, logos or watermarks.');
    form.append('image[]',new Blob([bytes],{type:'image/jpeg'}),'photo.jpg');
    form.append('size','auto');form.append('quality','medium');
    form.append('output_format','webp');form.append('output_compression','85');
    const response=await fetch('https://api.openai.com/v1/images/edits',{
      method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(150000)
    });
    const data=await response.json();
    if(!response.ok)return res.status(response.status===429?429:502).json({error:response.status===429?'Le service IA est occupé. Réessaie plus tard.':'Cette transformation n’a pas abouti. Essaie un autre filtre.'});
    const image=data?.data?.[0]?.b64_json;
    if(typeof image!=='string'||!image)return res.status(502).json({error:'Aucune image reçue. Ta photo est conservée.'});
    return res.status(200).json({image:`data:image/webp;base64,${image}`});
  }catch(error){
    return res.status(error.name==='TimeoutError'?504:502).json({error:error.name==='TimeoutError'?'La transformation a pris trop de temps. Réessaie.':'Service IA indisponible. Ta photo est conservée.'});
  }
}
