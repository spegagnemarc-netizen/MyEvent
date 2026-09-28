// Local-only integration preview: real isolated PostgreSQL + production social-inbox UI.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {setup,users,rpc,as} from './games-db.mjs';
const db=await setup(),root=resolve('.');
await db.exec(await readFile('supabase/migrations/202609280001_social_inbox.sql','utf8'));
await rpc(db,users[0],'friend_action',{other_id:users[1],action:'send'});
await rpc(db,users[1],'friend_action',{other_id:users[0],action:'accept'});
const allowed=new Set(['social_inbox_snapshot','social_friend_profiles','dm_open','dm_history','dm_send','dm_mark_read','social_notification_read','friend_action']);
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1:4174');
 if(req.method==='POST'&&u.pathname.startsWith('/rpc/')){
  const [, ,identity,name]=u.pathname.split('/');if(!users[+identity]||!allowed.has(name))throw Error('Invalid test call');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)throw Error('Too large');}
  try{res.setHeader('Content-Type','application/json');const args=JSON.parse(body||'{}'); const data=name==='social_friend_profiles'?(await as(db,users[+identity],'select * from public.social_friend_profiles($1)',[args.ids])).rows:await rpc(db,users[+identity],name,args);res.end(JSON.stringify({data}));}
  catch(e){res.end(JSON.stringify({error:{message:e.message}}));}return;
 }
 if(u.pathname==='/friends'){
  const i=+u.searchParams.get('user');if(!users[i])throw Error('Invalid test user');
  const data=(await as(db,users[i],"select user_low,user_high,status from public.friendships where status='accepted'")).rows;
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data}));return;
 }
 if(u.pathname==='/test'){
  const i=+u.searchParams.get('user')||0;if(!users[i])throw Error('Invalid identity');
  const index=await readFile('index.html','utf8');const overlay=index.slice(index.indexOf('<div id="myeventGlobalMessagesOverlay"'),index.indexOf('<link rel="stylesheet" href="css/social-inbox.css'));
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/inline-extracted.css"><link rel="stylesheet" href="/css/social-inbox.css"><style>body{background:#07121d;color:white;font:16px system-ui;padding:20px}button{padding:10px}header{display:flex;gap:15px}</style></head><body><h2>Compte de test ${i+1}</h2><header><button id="socialHeaderMessagesBtnTop" onclick="myeventSocialInbox.open('messages')">Messages</button><button id="socialHeaderNotificationsBtnTop" onclick="myeventSocialInbox.open('notifications')">Notifications</button></header><p>Base PostgreSQL locale isolée. Aucun compte de production.</p>${overlay}<script>const testUser='${users[i]}';const sb={rpc:async(name,args)=>(await fetch('/rpc/${i}/'+name,{method:'POST',body:JSON.stringify(args)})).json(),from:()=>({select:()=>({eq:async()=>(await fetch('/friends?user=${i}')).json()})}),channel:()=>({on(){return this},subscribe(cb){cb('TIMED_OUT');return this}}),removeChannel(){}};window.myeventCameraContext=()=>({sb,user:{id:testUser}});for(const id of ['closeGlobalMessagesBtn','closeGlobalNotificationsBtn'])document.getElementById(id).onclick=()=>{document.getElementById(id).closest('.myeventGlobalOverlay').classList.remove('open');myeventSocialInbox.closed();};</script><script src="/js/social-inbox.js"></script></body></html>`);return;
 }
 const path=resolve(root,'.'+u.pathname);if(!path.startsWith(root+'\\')||!/^\/(js|css)\//.test(u.pathname)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':'text/css');res.end(await readFile(path));
}catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(4174,'127.0.0.1',()=>console.log('Inbox preview http://127.0.0.1:4174/test?user=0 (A) and user=1 (B)'));
process.on('SIGINT',async()=>{server.close();await db.close();process.exit();});
