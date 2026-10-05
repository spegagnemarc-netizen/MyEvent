import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),yaml=require('js-yaml');
const project=new URL('../ios/project.yml',import.meta.url);
test('XcodeGen configuration parses and points to actual isolated sources and resources',()=>{
  const spec=yaml.load(readFileSync(project,'utf8'));
  assert.equal(spec.options.deploymentTarget.iOS,'17.0');
  const app=spec.targets.MyEventMobile;
  assert.ok(app.info.properties.NSCameraUsageDescription);assert.ok(app.info.properties.NSPhotoLibraryAddUsageDescription);
  assert.equal(app.info.properties.MyEventWebURL,'https://my-event-ii2zetly5-spegagnemarc-netizen.vercel.app/index.html');
  for(const item of app.sources)assert.ok(existsSync(new URL(typeof item==='string'?item:item.path,project)),JSON.stringify(item));
  assert.ok(spec.targets.MyEventMobileTests);assert.deepEqual(spec.schemes.MyEventMobile.test.targets,['MyEventMobileTests']);
});
test('Lens manifest schema parses with constrained local assets and integrity fields',()=>{
  const schema=JSON.parse(readFileSync(new URL('../lenses/manifest.schema.json',import.meta.url),'utf8'));
  assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.tracking.const,'face');
  const assets=new RegExp(schema.properties.asset.pattern);
  assert.ok(assets.test('wedding-glasses.usdz'));
  for(const value of ['../evil.usdz','https://partner.test/a.usdz','bad.js','a/b.usdz'])assert.equal(assets.test(value),false);
  assert.ok(schema.required.includes('sha256'));assert.ok(new RegExp(schema.properties.sha256.pattern).test('a'.repeat(64)));
});
