// Offline proposal generator. Reuses the installed foundation's comparison technique,
// without changing that foundation or executing anything remotely.
import {PGlite} from '@electric-sql/pglite';import {readFile,writeFile} from 'node:fs/promises';import {fixture,catalog} from './build-activities-migration.mjs';
export const venueCatalog=catalog.replaceAll('activities_private','venue_catalog_private').replaceAll("left(p.proname,11)='activities_'","left(p.proname,14)='venue_catalog_'");
const db=new PGlite();try{await db.exec(fixture);await db.exec(await readFile('docs/activities/proposal.sql','utf8'));const source=await readFile('docs/activities/catalog-v12-source.sql','utf8');await db.exec(source);const expected=(await db.query(venueCatalog)).rows[0].manifest;
const sql=`-- PROPOSAL ONLY. Explicit authorisation required before any remote application.
-- New schema, five tables and four public RPCs. Existing foundation unchanged.
DO $catalog_guard$
DECLARE expected jsonb:=$manifest$${JSON.stringify(expected)}$manifest$::jsonb;actual jsonb;bad text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('orevami-venue-catalog-v12-install',0));
 ${venueCatalog.replace(' as manifest','')} INTO actual;
 IF actual->'schema'<>'null'::jsonb OR jsonb_array_length(actual->'functions')>0 THEN
  IF actual IS DISTINCT FROM expected THEN SELECT key INTO bad FROM jsonb_each(expected) e WHERE actual->e.key IS DISTINCT FROM e.value ORDER BY key LIMIT 1;RAISE EXCEPTION 'Venue catalogue divergence: %',bad;END IF;
  RETURN;
 END IF;
 EXECUTE $catalog_install$${source}$catalog_install$;
 ${venueCatalog.replace(' as manifest','')} INTO actual;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Venue catalogue installation divergence';END IF;
END $catalog_guard$;\n`;
await writeFile('docs/activities/catalog-v12-proposal.sql',sql);await writeFile('docs/activities/catalog-v12-expected.json',JSON.stringify(expected,null,2)+'\n');}finally{await db.close();}
