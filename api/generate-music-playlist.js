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
  if(!request && mode!=='regenerate') return res.status(400).json({error:'Décris la playlist souhaitée.'});
  const instruction=mode==='add'
    ? 'Propose 8 recherches supplémentaires cohérentes avec la demande, sans répéter les morceaux actuels.'
    : mode==='regenerate'
      ? 'Recompose la partie non verrouillée de la playlist. Conserve impérativement les morceaux verrouillés et propose 16 recherches pour compléter la playlist.'
      : 'Propose 16 recherches de morceaux correspondant à la demande.';
  const prompt=`Tu es MyEvent Music IA. Tu prépares une playlist, mais tu ne fournis jamais de fichier audio et tu ne prétends pas qu'un morceau est disponible. Les résultats seront ensuite vérifiés dans le fournisseur musical réel.

Demande utilisateur : ${request || 'Refaire la playlist en conservant les titres verrouillés.'}
Action : ${instruction}

Morceaux actuels : ${JSON.stringify(current)}
Morceaux verrouillés à préserver : ${JSON.stringify(locked)}

Retourne UNIQUEMENT ce JSON :
{"title":"nom court de playlist","summary":"une phrase","searches":[{"query":"artiste titre","reason":"raison courte"}]}
Les recherches doivent être concrètes (artiste + titre si possible), variées, sans doublons, et adaptées à la demande. N'invente pas de disponibilité chez YouTube.`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:clean(process.env.OPENAI_MATERIAL_MODEL)||'gpt-5.6-luna',input:prompt,max_output_tokens:3500})});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'Music IA temporairement indisponible.'});
    const parsed=parseJson(outputText(data));
    const searches=(Array.isArray(parsed.searches)?parsed.searches:[]).slice(0,24).map(x=>({query:clean(x.query).slice(0,240),reason:clean(x.reason).slice(0,240)})).filter(x=>x.query);
    if(!searches.length) return res.status(502).json({error:'Music IA n’a proposé aucun morceau exploitable.'});
    return res.status(200).json({title:clean(parsed.title).slice(0,120),summary:clean(parsed.summary).slice(0,500),searches});
  }catch(e){return res.status(500).json({error:e?.message||'Impossible de générer la playlist.'});}
}
