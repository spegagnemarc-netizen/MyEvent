const {validate}=require('../js/accommodation-search-contract');
const {createAccommodationService}=require('../lib/accommodation-provider');
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non autorisée.'});}
  const q=req.body||{};let error;try{error=validate(q);}catch(_){error='Indique des dates valides.';}
  if(error)return res.status(400).json({error});
  try{return res.status(200).json(await createAccommodationService().search(q));}
  catch(e){const message=/^(Authentification Sabre CERT refusée|Disponibilité Sabre CERT refusée) \(HTTP \d{3}\)\.$/.test(e.message)?e.message:e.name==='TimeoutError'?'Sabre CERT ne répond pas dans le délai prévu. Réessaie.':'Le fournisseur est temporairement indisponible. Réessaie plus tard.';return res.status(502).json({error:message});}
};
