// Offline only: no DB client, no network, no execution of SQL.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const priorMigrations=[
 '20260923_music_v1.sql','20260923_social_camera_feed.sql','20260924_music_integrity.sql',
 '202609250001_marketplace.sql','202609250002_friends_stories.sql','202609270001_friend_invite_links.sql',
 '202609270002_games_engine.sql','202609270003_defis_game.sql','202609270004_event_member_profiles.sql',
 '202609270005_event_roles_visibility_feed.sql','202609270006_event_member_identity.sql','202609280001_social_inbox.sql',
 '202609280002_fix_event_creation_rls.sql','202609280002_story_interactions.sql','202609280003_feed_interactions.sql',
 '202609290001_v1_realtime_modules.sql','202609290002_marketplace_unread.sql','202609290003_supply_quantities.sql',
 '202609300001_event_tasks.sql','202609300002_social_locations.sql',
 '202610030001_platform_admin.sql','202610030002_admin_partner_content.sql'];
export function validateSchemaOnly(sql){
 // Ignore routine bodies/string literals/comments when checking top-level data statements.
 // This is a guardrail, not a substitute for review of schema routines/configuration.
 if(/sb_secret_|sb_publishable_|(?:postgres|postgresql):\/\/|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(sql))throw Error('Export refusé : identifiant API/secret possible. Inspecter localement sans partager le fichier.');
 const code=sql.replace(/\$([a-z_][a-z_0-9]*)?\$[\s\S]*?\$\1\$/gi,' ').replace(/'(?:''|[^'])*'/g,' ').replace(/--[^\n]*/g,' ').replace(/\/\*[\s\S]*?\*\//g,' ');
 if(/\b(?:insert\s+into|copy\s+|update\s+|delete\s+from|truncate\s+|setval\s*\()/i.test(code))throw Error('Export refusé : instructions de données détectées. Schéma seul obligatoire.');
 for(const table of ['profiles','events','event_members','marketplace_listings','platform_admins','admin_partner_content'])if(!new RegExp('CREATE TABLE(?: IF NOT EXISTS)? public\\.'+table+'\\b','i').test(sql))throw Error('Schéma incomplet : tables applicatives requises absentes.');
 if(/CREATE TABLE(?: IF NOT EXISTS)? public\.admin_account_controls\b/i.test(sql))throw Error('Export déjà en V2 : ne pas réexécuter 003.');
}
export async function prepare(schemaPath,output){
 const base=await readFile(schemaPath,'utf8');validateSchemaOnly(base);
 await mkdir(output,{recursive:true,mode:0o700});
 const chunks=[['01-current-schema-only.sql',base],
  ['02-storage-policies.sql',await readFile(new URL('../supabase/test/storage-policy-export.sql',import.meta.url),'utf8')],
  ['03-preflight.sql',await readFile(new URL('../supabase/admin/preflight.sql',import.meta.url),'utf8')],
  ['04-admin-v2.sql',await readFile(new URL('../supabase/migrations/202610030003_admin_v2.sql',import.meta.url),'utf8')],
  ['05-request-gate.sql',await readFile(new URL('../supabase/migrations/202610030004_admin_v21_request_gate.sql',import.meta.url),'utf8')]];
 const manifest=[];
 for(const [file,sql] of chunks){await writeFile(resolve(output,file),sql,{mode:0o600});manifest.push({file,sha256:createHash('sha256').update(sql).digest('hex'),purpose:file.startsWith('02')?'READ-ONLY source export query; save result separately, do NOT treat as target migration':'manual review/execute on TEST only'});}
 await writeFile(resolve(output,'plan.json'),JSON.stringify({requiresManualReview:true,noRemoteExecution:true,mode:'current-schema-only (001/002 already present in schema)',historicalInventory:priorMigrations,files:manifest},null,2)+'\n',{mode:0o600});
 return manifest.map(x=>({file:x.file,purpose:x.purpose}));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [schemaPath,output]=process.argv.slice(2);
 if(!schemaPath||!output){console.error('Usage: node scripts/prepare-admin-test.mjs <schema-only.sql> <private-output-dir>');process.exitCode=1;}
 else try{console.log(JSON.stringify(await prepare(schemaPath,output),null,2));}catch{console.error('Préparation refusée. Vérifier localement le schéma seul et les prérequis ; aucune donnée distante modifiée.');process.exitCode=1;}
}
