import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=new URL('../../../',import.meta.url);
test('Swift prototype and web/backend remain byte-for-byte unchanged from the mobile base',()=>{
  const diff=execFileSync('git',['diff','c68a693d47ff53fd3f71a93ae409342b0e90c20d','--','mobile/ios','mobile/bridge','index.html','js','css','api','server','supabase','vercel.json'],{cwd:root,encoding:'utf8'});
  assert.equal(diff,'');
  const hash=url=>createHash('sha256').update(readFileSync(url)).digest('hex');
  assert.equal(hash(new URL('assets/camera-me-logo.jpeg',root)),hash(new URL('../src/assets/camera-me-logo.jpeg',import.meta.url)));
});
test('app build configuration stays TEST-only, has no secrets and installs both platforms',()=>{
  const config=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
  assert.equal(config.android.package,'app.myevent.mobile.dev');assert.equal(config.ios.bundleIdentifier,'app.myevent.mobile.dev');
  assert.equal(config.updates.enabled,false);
  const runtime=readFileSync(new URL('../src/config.ts',import.meta.url),'utf8');
  assert.ok(runtime.includes('my-event-ii2zetly5'));assert.equal(runtime.includes('my-event-eosin'),false);
  assert.equal(JSON.stringify(config).includes('SUPABASE_SERVICE_ROLE_KEY'),false);
  const picker=config.plugins.find(p=>p[0]==='expo-image-picker')[1];
  assert.equal(typeof picker.cameraPermission,'string');assert.equal(typeof picker.microphonePermission,'string');
});
