import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const xml=readFileSync(new URL('../android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');
for(const permission of ['CAMERA','RECORD_AUDIO','ACCESS_FINE_LOCATION']){
  const tag=xml.match(new RegExp('<uses-permission[^>]*android:name="android.permission.'+permission+'"[^>]*/>'))?.[0];
  assert.ok(tag,'Permission absente : '+permission);
  assert.equal(tag.includes('tools:node="remove"'),false,'Permission bloquée par un plugin : '+permission);
}
console.log('Manifest Android généré : caméra, microphone et localisation déclarés sans blocage. Aucune permission utilisateur automatiquement accordée.');
