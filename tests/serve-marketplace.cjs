// Local UI fixture only. Never included by marketplace.html in production.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/marketplace-fixture'){
    let html=fs.readFileSync(path.join(root,'marketplace.html'),'utf8').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','/tests/marketplace-browser-fixture.js');
    html=html.replace('<body>','<body><p style="background:#ffdf91;padding:10px;margin:0">TEST LOCAL — données fictives, aucun accès à Supabase</p>');
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
  }
  const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const ext=path.extname(target);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[ext]||'application/octet-stream');res.end(fs.readFileSync(target));}
  catch{res.writeHead(404).end();}
}).listen(8766,'127.0.0.1',()=>console.log('Marketplace UI fixture: http://127.0.0.1:8766/marketplace-fixture'));
