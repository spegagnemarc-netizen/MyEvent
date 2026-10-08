import {spawnSync} from 'node:child_process';
import {verifyTestTarget} from './test-target.mjs';
// Refuse Production and authenticated/bypass URLs before generating a native project.
await verifyTestTarget(process.env.EXPO_PUBLIC_MYEVENT_WEB_URL);
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['expo','prebuild','--platform','android','--no-install'],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,MYEVENT_BUILD_PROFILE:'test-private'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
