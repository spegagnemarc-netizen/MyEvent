const {validate}=require('../js/accommodation-search-contract');
const {createAccommodationService}=require('../lib/accommodation-provider');
const {SabreError}=require('../lib/sabre-provider');
function createHandler({serviceFactory=createAccommodationService,logger=console}={}){return async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non autorisée.'});}
  const q=req.body||{};let error;try{error=validate(q);}catch(_){error='Indique des dates valides.';}
  if(error)return res.status(400).json({error});
  try{return res.status(200).json(await serviceFactory().search(q));}
  catch(e){const known=e instanceof SabreError;const code=known?e.code:'SABRE_INTERNAL_ERROR';const diagnostics=known?e.diagnostics:{stage:'internal'};const message=known?e.message:'Le fournisseur est temporairement indisponible. Réessaie plus tard.';logger.error('accommodation-search-failed',{code,...diagnostics});return res.status(502).json({error:message,code,diagnostics});}
};}
module.exports=createHandler();
module.exports.createHandler=createHandler;
