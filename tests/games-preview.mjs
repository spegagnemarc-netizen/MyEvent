// Local-only browser test fixture. Production UI + actual isolated PostgreSQL migrations.
// Identities are synthetic; no production credentials or Supabase requests are used.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {setup,users,rpc} from './games-db.mjs';
const db=await setup(),root=resolve('.');
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4173');
  if(req.method==='POST'&&url.pathname.startsWith('/rpc/')){
   const [, ,identity,name]=url.pathname.split('/');
   if(!users[Number(identity)]||!['game_create','game_join','game_action','game_snapshot','game_my_rooms','game_contacts','defis_create','defis_join','defis_action','defis_snapshot','defis_my_rooms','defis_contacts'].includes(name))throw Error('Invalid test request');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error('Body too large');}
   try {const data=await rpc(db,users[Number(identity)],name,JSON.parse(body||'{}'));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data}));}
   catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{message:e.message}}));}return;
  }
  if(url.pathname==='/test'){
   const i=Number(url.searchParams.get('user')||0);if(!users[i])throw Error('Invalid identity');
   const index=await readFile('index.html','utf8');
   const styles=[...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m=>m[1]).filter(x=>!x.startsWith('http'));
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map(x=>`<link rel="stylesheet" href="/${x}">`).join('')}<title>MyEvent — test local ${i+1}</title></head><body><button id="socialHeaderGamesBtn">Jeux</button><p>Compte de test ${i+1} — base locale isolée</p><section id="entertainmentLounge" aria-hidden="true" role="dialog" aria-label="Salon Jeux MyEvent" aria-modal="true"></section><script>window.myeventGameContext=()=>({user:{id:'${users[i]}'},sb:{rpc:async(name,args)=>(await fetch('/rpc/${i}/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)})).json(),channel:()=>({on(){return this},subscribe(fn){fn('TIMED_OUT');return this}}),removeChannel(){}}});</script><script src="/js/invitation-context.js"></script><script src="/js/game-session.js"></script><script src="/js/entertainment-lounge.js"></script></body></html>`);return;
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(root+'\\')||(!url.pathname.startsWith('/js/')&&!url.pathname.startsWith('/css/')&&!url.pathname.startsWith('/assets/'))) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch(e){res.writeHead(500);res.end(e.message);}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local isolated games test: http://127.0.0.1:4173/test?user=0 (user=0..7)'));
process.on('SIGINT',async()=>{server.close();await db.close();process.exit();});
