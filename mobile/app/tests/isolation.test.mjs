import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=new URL('../../../',import.meta.url);
test('imported Swift prototype and legacy bridge remain unchanged from the verified mobile source',()=>{
  const diff=execFileSync('git',['diff','f2f5e861c364331c5cad81fabaa2d9511ff6d4dd','--','mobile/ios','mobile/bridge'],{cwd:root,encoding:'utf8'});
  assert.equal(diff,'');
  const hash=url=>createHash('sha256').update(readFileSync(url)).digest('hex');
  assert.equal(hash(new URL('assets/camera-me-logo.jpeg',root)),hash(new URL('../src/assets/camera-me-logo.jpeg',import.meta.url)));
});
test('app configuration preserves the approved configurable WebView target without secrets',()=>{
  const config=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
  assert.equal(config.android.package,'app.myevent.mobile.dev');assert.equal(config.ios.bundleIdentifier,'app.myevent.mobile.dev');
  assert.equal(config.updates.enabled,false);
  const runtime=readFileSync(new URL('../src/config.ts',import.meta.url),'utf8');
  assert.ok(runtime.includes('EXPO_PUBLIC_MYEVENT_WEB_URL'));assert.ok(runtime.includes('my-event-eosin'));
  assert.equal(JSON.stringify(config).includes('SUPABASE_SERVICE_ROLE_KEY'),false);
  const picker=config.plugins.find(p=>p[0]==='expo-image-picker')[1];
  assert.equal(typeof picker.cameraPermission,'string');assert.equal(typeof picker.microphonePermission,'string');
});
