const {validate}=require('../js/accommodation-search-contract');
const {createAccommodationService}=require('../lib/accommodation-provider');
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non autorisée.'});}
  const q=req.body||{};let error;try{error=validate(q);}catch(_){error='Indique des dates valides.';}
  if(error)return res.status(400).json({error});
  try{return res.status(200).json(await createAccommodationService().search(q));}
  catch(_){return res.status(502).json({error:'Le fournisseur est temporairement indisponible. Réessaie plus tard.'});}
};
