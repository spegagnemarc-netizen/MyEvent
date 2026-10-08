// Generated from canonical integrations. The official Expedia script needs
// the normal parser/DOMContentLoaded sequence, not a late dynamic insertion.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function fragment(startPattern,tag){const start=html.search(startPattern);if(start<0)throw Error('Canonical fragment missing: '+startPattern);const matcher=new RegExp('</?'+tag+'\\b[^>]*>','g');matcher.lastIndex=start;let depth=0,match;while((match=matcher.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,matcher.lastIndex);}throw Error('Unclosed canonical fragment');}
const scripts=html.match(/<script\b[^>]*>[\s\S]*?<\/script>/g)||[];
const eg=scripts.find(s=>s.includes('class="eg-widgets-script"')),omio=scripts.find(s=>s.includes('function addOmioWidget')),ticketSearch=scripts.find(s=>s.includes('function tn_SubmitSearch_'));
if(!eg||!omio||!ticketSearch)throw Error('Canonical loader missing');
const accommodation=fragment(/<div id="m58AccommodationSearchBox"/,'div').replace(/<div class="m58ModuleActions"><button[^>]+id="m58AccommodationSearchCancel"[\s\S]*?<\/div>/,'').replace('Après réservation, ajoute ton hébergement au planning avec « Ajouter un hébergement ».','Après réservation, retrouve Explorer → Mes réservations pour ajouter ton lien.');
const transport=fragment(/<div id="myeventOmioSection"/,'div')+fragment(/<section id="myeventExpediaFlightsSection"/,'section');
const ticket=fragment(/<div class='tnSearchWidget'/,'div');
for(const [kind,body,loader] of [['accommodation',accommodation,'<script src="js/place-card.js"></script><script src="js/accommodation-search-runtime.js"></script>'+eg],['transport',transport,'<script src="js/accommodation-search-runtime.js"></script>'+eg+omio],['ticket',ticket,ticketSearch]]){
 const page='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Partenaires · MyEvent</title><link rel="stylesheet" href="css/inline-extracted.css"><link rel="stylesheet" href="css/explorer.css"><link rel="stylesheet" href="css/partner-containers.css"><style>body{padding:12px}.m58SearchBox.hidden{display:block!important}.tnSearchWidget{width:100%!important;max-width:100%}.myeventPartnerSelector{display:flex;gap:8px;flex-wrap:wrap}[data-omio-widget], [data-omio-widget] form{max-width:100%;min-width:0}</style></head><body><!-- Generated from index.html; edit the canonical source, then regenerate. --><p>Recherche et réservation chez le partenaire.</p><main>'+body+'</main>'+loader+'<script src="js/partner-height.js"></script></body></html>\n';
 fs.writeFileSync(path.join(root,'explorer-partners-'+kind+'.html'),page);
}
console.log('Generated 3 static partner pages; affiliate snippets and early loaders preserved.');
