import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import handler from '../server/event-deletion-handler.mjs';
const ref='ahyyknfjsielnqyoxqgh',base=`https://${ref}.supabase.co`;
const secretFile='C:/Users/spega/AppData/Local/Temp/orevami-storage-test-key.txt';
const secret=(process.env.OREVAMI_STORAGE_TEST_SECRET||'').trim();
if(!/^sb_secret_[A-Za-z0-9_-]+$/.test(secret))throw Error('Clé moderne TEST absente du champ sécurisé local. Aucun appel API effectué.');
const adminHeaders={apikey:secret};
process.env.VERCEL_ENV='preview';process.env.SUPABASE_URL=base;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_QeFWC43oF-TMhWV_2tmWSA_thLmOyfR';
process.env.MYEVENT_TEST_SUPABASE_REF=ref;process.env.SUPABASE_SECRET_KEY=secret;
const realFetch=globalThis.fetch,createdUsers=[],createdEvents=[],files=[];
let voiceBucketCreated=false;
const report={project:ref,commit:'4db5b4fd0e723074d697838da21089d620ce269e',checks:[],fixtures:{},cleanup:[]};
async function api(path,{method='GET',body,token=secret,raw=false}={}){
 const response=await realFetch(base+path,{method,headers:{...(token===secret?adminHeaders:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token}),...(raw?{'Content-Type':'text/plain'}:{'Content-Type':'application/json',Prefer:'return=representation'})},body:body===undefined?undefined:raw?body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await response.text();
 if(!response.ok)throw Error(`TEST ${method} ${path.split('?')[0]} HTTP ${response.status}: ${text.replaceAll(secret,'[secret]').slice(0,350)}`);
 return text?JSON.parse(text):null;
}
async function fixtureUser(){
 const email='storage-'+randomUUID()+'@example.invalid',password=randomUUID()+'Aa!9';
 const user=await api('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
 createdUsers.push(user.id);
 await api('/rest/v1/profiles',{method:'POST',body:{id:user.id,username:'storage_'+user.id.replaceAll('-',''),display_name:'Validation Storage fictive'}});
 const session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 return {id:user.id,token:session.access_token};
}
async function fixtureEvent(owner,label){
 const event=(await api('/rest/v1/events',{method:'POST',token:owner.token,body:{creator_id:owner.id,name:label,is_private:true}}))[0];
 createdEvents.push(event.id);return event.id;
}
async function upload(bucket,event,owner,label){
 const path=`${event}/${owner}/${label}.txt`,body='OREVAMI SYNTHETIC '+label;
 await api('/storage/v1/object/'+bucket+'/'+path,{method:'POST',body,raw:true});
 files.push({bucket,path,body});return path;
}
async function invoke(token,eventId){
 let status,body;
 const res={setHeader(){},status(value){status=value;return this;},json(value){body=value;return this;}};
 await handler({method:'POST',headers:{authorization:'Bearer '+token},body:eventId?{eventId}:{}},res);
 return {status,body};
}
async function inventory(event,owner){return api('/rest/v1/rpc/event_storage_cleanup_items',{method:'POST',body:{p_event_id:event,p_owner_id:owner}});}
async function witnessFile(file){
 const response=await realFetch(base+'/storage/v1/object/authenticated/'+file.bucket+'/'+file.path,{headers:adminHeaders});
 assert.equal(response.status,200);assert.equal(await response.text(),file.body);
}
try{
 await api('/rest/v1/rpc/event_storage_cleanup_pending',{method:'POST',body:{p_owner_id:randomUUID()}});
 const buckets=await api('/storage/v1/bucket');
 if(!buckets.some(x=>x.id==='event-voices')){
  await api('/storage/v1/bucket',{method:'POST',body:{id:'event-voices',name:'event-voices',public:false}});voiceBucketCreated=true;
 }
 const owner=await fixtureUser(),other=await fixtureUser();
 const target=await fixtureEvent(owner,'TEST jetable Storage cible'),witness=await fixtureEvent(other,'TEST jetable Storage témoin');
 report.fixtures={target,witness,owner:owner.id,other:other.id};
 await api('/rest/v1/event_members',{method:'POST',token:owner.token,body:{event_id:target,user_id:owner.id,role:'owner'}});
 await upload('event-media',target,owner.id,'photo');
 await upload('event-media',target,owner.id,'orphan');
 await upload('event-voices',target,owner.id,'voice');
 await upload('event-media',witness,other.id,'witness-media');
 await upload('event-voices',witness,other.id,'witness-voice');
 const witnessFiles=files.filter(x=>x.path.startsWith(witness+'/'));
 const denied=await invoke(other.token,target);
 assert.notEqual(denied.status,200);
 assert.equal((await api('/rest/v1/events?id=eq.'+target)).length,1);
 report.checks.push('Autre compte refusé ; événement cible conservé');
 let injected=false;
 globalThis.fetch=async(url,options)=>{
  if(!injected&&String(url)===base+'/storage/v1/object/event-voices'&&options?.method==='DELETE'){
   injected=true;return new Response('{}',{status:503});
  }
  return realFetch(url,options);
 };
 const partial=await invoke(owner.token,target);
 globalThis.fetch=realFetch;
 assert.equal(injected,true);assert.equal(partial.status,200);assert.equal(partial.body.deleted,true);assert.equal(partial.body.cleanupPending,true);
 const remaining=await inventory(target,owner.id);
 assert.equal(remaining.length,1);assert.equal(remaining[0].bucket_id,'event-voices');
 assert.equal((await api('/rest/v1/events?id=eq.'+target)).length,0);
 assert.equal((await api('/rest/v1/event_members?event_id=eq.'+target)).length,0);
 report.checks.push('Suppression propriétaire acceptée ; cascade membres ; panne injectée après retrait des médias, vocal en attente durable');
 const late=await realFetch(base+'/storage/v1/object/event-media/'+target+'/'+owner.id+'/late.txt',{method:'POST',headers:{...adminHeaders,'Content-Type':'text/plain'},body:'LATE SYNTHETIC'});
 assert.equal(late.ok,false);
 report.checks.push('Upload tardif refusé par le trigger, même via serveur privilégié');
 for(const file of witnessFiles)await witnessFile(file);
 assert.equal((await api('/rest/v1/events?id=eq.'+witness)).length,1);
 report.checks.push('Événement témoin et ses deux binaires strictement préservés après suppression partielle');
 const resumed=await invoke(owner.token);
 assert.equal(resumed.status,200);assert.equal(resumed.body.cleanupPending,false);
 assert.equal((await inventory(target,owner.id)).length,0);
 for(const file of files.filter(x=>x.path.startsWith(target+'/'))){
  const response=await realFetch(base+'/storage/v1/object/authenticated/'+file.bucket+'/'+file.path,{headers:adminHeaders});
  assert.equal(response.ok,false);
 }
 report.checks.push('Reprise du handler réussi ; inventaire vide et trois binaires cible absents');
 for(const file of witnessFiles)await witnessFile(file);
 assert.equal((await api('/rest/v1/events?id=eq.'+witness)).length,1);
 report.checks.push('Témoin préservé après reprise ; aucun événement existant utilisé');
 report.success=true;
}catch(error){report.success=false;report.failure=error.message;process.exitCode=1;}
finally{
 globalThis.fetch=realFetch;
 // Cleanup only the exact synthetic paths and IDs created by this run.
 for(const bucket of ['event-media','event-voices']){
  const paths=files.filter(x=>x.bucket===bucket).map(x=>x.path);
  if(paths.length)try{await api('/storage/v1/object/'+bucket,{method:'DELETE',body:{prefixes:paths}});}catch{report.cleanup.push('Fichiers fictifs à reprendre : '+bucket);}
 }
 for(const id of createdEvents)try{await api('/rest/v1/events?id=eq.'+id,{method:'DELETE'});}catch{report.cleanup.push('Événement fictif à reprendre : '+id);}
 for(const id of createdUsers)try{await api('/auth/v1/admin/users/'+id,{method:'DELETE'});}catch{report.cleanup.push('Compte fictif à reprendre : '+id);}
 if(voiceBucketCreated)try{await api('/storage/v1/bucket/event-voices',{method:'DELETE'});}catch{report.cleanup.push('Bucket vocal TEST conservé');}
 delete process.env.SUPABASE_SECRET_KEY;delete process.env.OREVAMI_STORAGE_TEST_SECRET;
 await writeFile('docs/orevami/storage-test-result.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
