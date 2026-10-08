// Server-only seam. Replace the adapter only after supplier approval.
// search(query, {signal}) returns {status, results, warnings}; never synthesize offers.
const unavailableProvider={id:'unavailable',async search(){return {status:'unavailable',results:[],warnings:['La recherche intégrée est indisponible : aucun fournisseur autorisé n’est activé. Aucun prix ni disponibilité n’est confirmé.']};}};
function createAccommodationService(provider=require('./sabre-provider').createSabreProvider()){return {async search(query,options){return provider.search(query,options);}};}
module.exports={createAccommodationService,unavailableProvider};
