// A build preparation wrapper, never a submission command. No secrets in output.
import {spawn} from 'node:child_process';
const platform=process.argv[2];
if(!['ios','android'].includes(platform))throw Error('Usage: npm run build:private -- ios|android [--prepare-only]');
const raw=process.env.EXPO_PUBLIC_MYEVENT_WEB_URL;
let url;
try{url=new URL(raw);}catch{throw Error('Provide the real Preview TEST URL in EXPO_PUBLIC_MYEVENT_WEB_URL.');}
if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.username||url.password||url.search||url.hash||!['/','/index.html'].includes(url.pathname))throw Error('Preview TEST HTTPS URL required; no bypass tokens.');
const r=await fetch(new URL('/api/runtime-config',url),{redirect:'manual',signal:AbortSignal.timeout(15000)});
if(r.status!==200)throw Error('Preview configuration unavailable; no build started.');
const c=await r.json();
if(c.environment!=='preview'||c.isTest!==true||c.projectRef!=='ahyyknfjsielnqyoxqgh'||c.url!=='https://ahyyknfjsielnqyoxqgh.supabase.co')throw Error('Target is not the authorized Supabase TEST project; no build started.');
console.log('Preview Supabase TEST verified; no data mutated.');
if(process.argv.includes('--prepare-only')){console.log(`Prepared command: eas build --platform ${platform} --profile private-test (not executed).`);process.exit(0);}
if(!process.env.OREVAMI_EAS_PROJECT_ID||!process.env.OREVAMI_EXPO_OWNER)throw Error('Provide the real EAS project ID and Expo owner before building.');
console.log('Starting a PRIVATE signed build. No automatic credential creation or submission is authorized by this wrapper.');
const child=spawn('eas',['build','--platform',platform,'--profile','private-test','--non-interactive'],{stdio:'inherit',env:{...process.env,OREVAMI_TEST_TARGET_VERIFIED:'1'}});
child.on('error',error=>{console.error(error.code==='ENOENT'?'Install the official EAS CLI first.':error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
