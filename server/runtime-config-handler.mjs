import {supabaseEnvironment} from './supabase-environment.mjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Méthode non autorisée.'});
 try{return res.status(200).json(supabaseEnvironment());}
 catch(error){
  const message=error instanceof Error?error.message:'Configuration Supabase invalide.';
  return res.status(503).json({error:message});
 }
}
