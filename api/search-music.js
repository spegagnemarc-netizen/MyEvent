export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=300');
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non autorisée'});
  const q=String(req.query.q||'').trim();
  if(q.length<2)return res.status(400).json({error:'Recherche trop courte'});
  const key=process.env.YOUTUBE_API_KEY;
  if(!key)return res.status(503).json({error:'YOUTUBE_API_KEY non configurée'});
  try{
    const p=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'12',q,relevanceLanguage:'fr',regionCode:'FR',key});
    const r=await fetch('https://www.googleapis.com/youtube/v3/search?'+p);
    const data=await r.json();
    if(!r.ok)throw new Error(data?.error?.message||'Erreur YouTube');
    const items=(data.items||[]).map(x=>({provider:'youtube',provider_track_id:x.id?.videoId,title:x.snippet?.title||'',artist:x.snippet?.channelTitle||'',thumbnail_url:x.snippet?.thumbnails?.medium?.url||x.snippet?.thumbnails?.default?.url||''})).filter(x=>x.provider_track_id);
    return res.status(200).json({items});
  }catch(e){return res.status(502).json({error:e.message||'Recherche YouTube indisponible'});}
}