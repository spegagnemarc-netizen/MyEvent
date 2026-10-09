// Local browser QA with explicit fixtures; no live Sabre or Supabase calls.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const viewport of [{width:390,height:744},{width:1280,height:800}]){
  const page=await browser.newPage({viewport,hasTouch:viewport.width<600,isMobile:viewport.width<600});const calls=[];
  await page.addInitScript(()=>{window.sb={auth:{getUser:async()=>({data:{user:{id:'owner-fixture'}}}),getSession:async()=>({data:{session:{user:{id:'owner-fixture'},access_token:'fixture-user-jwt'}}}),onAuthStateChange:()=>{}},rpc:async name=>({data:name==='myevent_is_admin'?true:{}})};});
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.hostname!=='myevent.test')return route.abort();
   if(u.pathname==='/api/runtime-config')return route.fulfill({json:{environment:'preview',isTest:true,url:'https://ahyyknfjsielnqyoxqgh.supabase.co',projectRef:'ahyyknfjsielnqyoxqgh',publishableKey:'sb_publishable_fixture',authStorageKey:'fixture'}});
   if(u.pathname==='/api/admin-sabre-diagnostic'){calls.push(route.request().postDataJSON());return route.fulfill({json:{real:true,environment:'cert',connection:'connected',oauthHttp:[200],cases:[{pcc:'S5OM',http:[200],status:'unavailable',hotelCount:0,warningCodes:['WARN.0366'],warnings:['Réponse simulée pour QA navigateur, pas un résultat Sabre réel.'],hotels:[]}]}});}
   const file=path.resolve(root,u.pathname.slice(1)||'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});let body=fs.readFileSync(file);
   if(file.endsWith('index.html'))body=body.toString().replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi,(tag,attrs)=>/src="\/?js\/(runtime-config|admin-runtime)\.js/.test(attrs)?tag:'');
   return route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript'});
  });
  await page.goto('http://myevent.test/');await page.locator('#myeventAdminEntry').evaluate(el=>el.click());await page.locator('#myeventAdminPanel').waitFor({state:'visible'});
  await page.locator('#myeventAdminSabreTab').click();await page.locator('[data-sabre-action="connection"]').click();await page.getByText('Connexion réussie',{exact:false}).waitFor();
  await page.locator('[data-sabre-action="compare"]').click();assert.equal(calls.length,2);assert.equal(calls[1].action,'compare');assert.equal(calls[1].pcc,'S5OM');
  await page.locator('#myeventAdminSabreResults').getByText('WARN.0366',{exact:true}).waitFor({state:'visible'});
  const bounds=await page.evaluate(()=>{const panel=document.getElementById('myeventAdminPanel'),form=document.getElementById('myeventAdminSabreForm');return {client:panel.clientWidth,scroll:panel.scrollWidth,form:form.getBoundingClientRect().right,viewport:innerWidth,top:panel.getBoundingClientRect().top,banner:document.getElementById('myeventEnvironmentBanner').getBoundingClientRect().bottom};});
  assert(bounds.scroll<=bounds.client+1,'no horizontal overflow');assert(bounds.form<=bounds.viewport,'form fits viewport');assert(bounds.top>=bounds.banner,'TEST banner does not cover admin panel');
  console.log('Chromium fixture QA',viewport.width,'px: controls, POST, errors, responsive layout, TEST banner OK');await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
