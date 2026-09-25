import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/generate-music-playlist.js';

function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};}

test('Music IA plans the requested 30 real-song searches without exposing the server key',async()=>{
  const previous=process.env.OPENAI_API_KEY,originalFetch=globalThis.fetch;
  process.env.OPENAI_API_KEY='server-only-test-key';
  let request;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization,'Bearer server-only-test-key');
    request=JSON.parse(options.body);
    return {ok:true,json:async()=>({output:[{content:[{text:JSON.stringify({title:'Soirée 2000',summary:'Festive',searches:Array.from({length:35},(_,i)=>({query:`Artiste ${i} Titre ${i}`,reason:'Dance'}))})}]}]})};
  };
  try{
    const res=response();await handler({method:'POST',body:{mode:'generate',request:'soirée années 2000, festive, 30 morceaux'}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.count,30);assert.equal(res.body.searches.length,35);
    assert.match(request.input,/playlist de 30 morceaux/);assert.doesNotMatch(JSON.stringify(res.body),/server-only-test-key/);
    const regenerated=response();await handler({method:'POST',body:{mode:'regenerate',request:'soirée années 2000, festive, 30 morceaux',locked_tracks:[{title:'Titre conservé',artist:'Artiste'}],current_tracks:[{title:'Titre conservé',artist:'Artiste',locked:true}]}},regenerated);
    assert.equal(regenerated.body.count,29);assert.match(request.input,/verrouillés restent en place/);
  }finally{globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});

test('Music IA refuses an empty request and missing server credentials',async()=>{
  const previous=process.env.OPENAI_API_KEY;
  try{
    process.env.OPENAI_API_KEY='test';let res=response();await handler({method:'POST',body:{request:'  '}},res);assert.equal(res.statusCode,400);
    delete process.env.OPENAI_API_KEY;res=response();await handler({method:'POST',body:{request:'Jazz'}},res);assert.equal(res.statusCode,503);
  }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});
