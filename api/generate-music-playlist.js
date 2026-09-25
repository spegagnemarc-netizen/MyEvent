const clean = value => String(value == null ? '' : value).trim();

function parseJson(text) {
  const raw = clean(text).replace(/^\`\`\`json\s*/i,'').replace(/^\`\`\`\s*/,'').replace(/\s*\`\`\`$/,'').trim();
  return JSON.parse(raw);
}

function outputText(data) {
  if (data?.output_text) return data.output_text;
  return Array.isArray(data?.output) ? data.output.flatMap(x => Array.isArray(x.content) ? x.content : []).map(x => x.text || '').join('') : '';
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Méthode non autorisée.'});
  const apiKey=clean(process.env.OPENAI_API_KEY);
  if(!apiKey) return res.status(503).json({error:'Le service Music IA n’est pas configuré.'});
  const body=req.body||{}, mode=['generate','add','regenerate'].includes(body.mode)?body.mode:'generate';
  const request=clean(body.request).slice(0,1200);
  const locked=(Array.isArray(body.locked_tracks)?body.locked_tracks:[]).slice(0,40).map(t=>({title:clean(t.title).slice(0,180),artist:clean(t.artist).slice(0,180)})).filter(t=>t.title);
  const current=(Array.isArray(body.current_tracks)?body.current_tracks:[]).slice(0,60).map(t=>({title:clean(t.title).slice(0,180),artist:clean(t.artist).slice(0,180),locked:!!t.locked})).filter(t=>t.title);
  if(!request) return res.status(400).json({error:'Décris la playlist souhaitée.'});
  // The requested size belongs to the whole playlist, including tracks the user kept.
  const requested=Number(request.match(/\b(\d{1,2})\s*(?:morceaux|titres|chansons|sons)\b/i)?.[1]);
  const total=Math.min(40,Math.max(1,requested||current.length||16));
  const count=mode==='add'?Math.min(12,Math.max(5,requested||8)):
    mode==='regenerate'?Math.max(0,total-locked.length):total;
  if(!count) return res.status(200).json({title:'',summary:'Tous les morceaux sont conservés.',searches:[],count:0});
  const instruction=mode==='add'
    ? `Ajoute ${count} morceaux différents à la playlist existante.`
    : mode==='regenerate'
      ? `Remplace ${count} morceaux non verrouillés. Les morceaux verrouillés restent en place.`
      : `Propose une playlist de ${count} morceaux.`;
  const prompt=`Tu es MyEvent Music IA. Tu prépares une playlist, mais tu ne fournis jamais de fichier audio et tu ne prétends pas qu'un morceau est disponible. Les résultats seront ensuite vérifiés dans le fournisseur musical réel.

Demande utilisateur : ${request || 'Refaire la playlist en conservant les titres verrouillés.'}
Action : ${instruction}

Morceaux actuels : ${JSON.stringify(current)}
Morceaux verrouillés à préserver : ${JSON.stringify(locked)}

Retourne UNIQUEMENT ce JSON :
{"title":"nom court de playlist","summary":"une phrase","searches":[{"query":"artiste titre","reason":"raison courte"}]}
Donne ${Math.min(48,count+Math.max(4,Math.ceil(count/4)))} recherches de chansons réelles et distinctes (artiste + titre), en commençant par les meilleures. Évite les morceaux actuels pour les remplacements et ajouts. Respecte le style et l'époque demandés. N'invente pas de disponibilité chez YouTube.`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:clean(process.env.OPENAI_MATERIAL_MODEL)||'gpt-5.6-luna',input:prompt,max_output_tokens:8000})});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'Music IA temporairement indisponible.'});
    const parsed=parseJson(outputText(data));
    const searches=(Array.isArray(parsed.searches)?parsed.searches:[]).slice(0,48).map(x=>({query:clean(x.query).slice(0,240),reason:clean(x.reason).slice(0,240)})).filter(x=>x.query);
    if(!searches.length) return res.status(502).json({error:'Music IA n’a proposé aucun morceau exploitable.'});
    return res.status(200).json({title:clean(parsed.title).slice(0,120),summary:clean(parsed.summary).slice(0,500),searches,count});
  }catch(e){return res.status(500).json({error:e?.message||'Impossible de générer la playlist.'});}
}
