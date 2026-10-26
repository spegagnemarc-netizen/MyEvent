'use strict';
// The upload is an explicit allowlist, never the repository or an authenticated app build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function prepare(){
 const root=__dirname,original=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const html=original.replace('<body>','<body data-hosting="static-preview">');
 if(html===original)throw Error('Missing public document boundary');
 const sourceHeaders=JSON.parse(fs.readFileSync(path.join(root,'headers.json'),'utf8'));
 const config={framework:null,buildCommand:null,installCommand:null,headers:[{source:'/(.*)',headers:Object.entries(sourceHeaders).map(([key,value])=>({key,value}))}],cleanUrls:false,rewrites:[]};
 const files=[{file:'index.html',data:html},{file:'vercel.json',data:JSON.stringify(config,null,2)+'\n'}];
 for(const item of files){if(/supabase\.co|service_role|access_token|adsbygoogle|googlesyndication|(?:sk|pk)_live_|__NEXT_DATA__/.test(item.data))throw Error('Private or advertising material in preview package');}
 return {files,manifest:files.map(x=>({file:x.file,bytes:Buffer.byteLength(x.data),sha256:crypto.createHash('sha256').update(x.data).digest('hex')})),config};
}
module.exports={prepare};
if(require.main===module){const bundle=prepare();console.log(JSON.stringify({environment:'preview',adsEnabled:false,files:bundle.manifest},null,2));}
