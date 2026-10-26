'use strict';
// Local inspection only: no dotenv, credentials, database client, proxy, API or arbitrary file serving.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
function createControlChannel(){
 let suspended=false;const listeners=new Set();
 const state=()=>({adsEnabled:false,suspended});
 return Object.freeze({state,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},suspend(){suspended=true;for(const fn of listeners)fn(state());}});
}
function createServer({control=createControlChannel()}={}){
 const html=fs.readFileSync(path.join(__dirname,'index.html'));
 const headers=JSON.parse(fs.readFileSync(path.join(__dirname,'headers.json'),'utf8'));
 return http.createServer((req,res)=>{
  for(const [key,value] of Object.entries(headers))res.setHeader(key,value);
  const reply=(status,text,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:text);};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return reply(405,'Method not allowed');}
  if(req.headers.authorization||req.headers.cookie)return reply(400,'This public TEST origin does not accept credentials.');
  const url=new URL(req.url,'http://localhost');
  if(url.search)return reply(400,'This TEST surface does not accept query parameters.');
  if(url.pathname==='/control-events'){
   if(req.method!=='GET')return reply(405,'GET required');
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive'});
   const send=state=>res.write('data: '+JSON.stringify(state)+'\n\n');send(control.state());
   const unsubscribe=control.subscribe(send);req.on('close',unsubscribe);return;
  }
  if(url.pathname==='/health')return reply(200,'{"status":"ok","environment":"local-test","adsEnabled":false,"privateData":false}','application/json');
  if(url.pathname!=='/'&&url.pathname!=='/index.html')return reply(404,'Not found');
  reply(200,html,'text/html; charset=utf-8');
 });
}
module.exports={createServer,createControlChannel};
if(require.main===module){const port=Number(process.argv[2]||4178);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');createServer().listen(port,'127.0.0.1',()=>console.log('Isolated discovery TEST ready: http://127.0.0.1:'+port));}
