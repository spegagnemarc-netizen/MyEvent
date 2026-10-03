import {supabaseEnvironment} from '../server/supabase-environment.mjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Méthode non autorisée.'});
 try{return res.status(200).json(supabaseEnvironment());}
 catch{return res.status(503).json({error:'Connexion désactivée : configurer le projet Supabase de test dans cet environnement Vercel.'});}
}
