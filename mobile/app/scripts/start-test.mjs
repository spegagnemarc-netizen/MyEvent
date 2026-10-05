import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyTestTarget} from './test-target.mjs';
try{
 const target=await verifyTestTarget(process.env.EXPO_PUBLIC_MYEVENT_WEB_URL);
 console.log('Cible Explorer / Supabase TEST vérifiée. Aucun secret ni accès Vercel contourné.');
 const args=process.argv.slice(2),mode=args.includes('--go')?'--go':'--dev-client';
 const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/expo/bin/cli',import.meta.url)),'start',mode,'--clear',...args.filter(arg=>arg!=='--go')],{stdio:'inherit',env:{...process.env,EXPO_PUBLIC_MYEVENT_WEB_URL:target}});
 child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
}catch(error){console.error(error.message);process.exitCode=1;}
