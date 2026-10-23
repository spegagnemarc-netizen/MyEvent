// Local-only packaging: exact recovered V2 catalogue, no network or credentials.
import {readFile,writeFile} from 'node:fs/promises';
import {catalog} from './activities-test-fixture.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const source=await read('docs/production-v1/002-install-closed-corrected.sql');
const expected=source.match(/\$production_expected\$([\s\S]+?)\$production_expected\$/)[1];
const guard=`-- PROPOSAL ONLY. Not applied. One-time closed V2 -> inclusive access V4.\nBEGIN;\nSET LOCAL lock_timeout='5s';\nDO $guard$ DECLARE actual jsonb; expected jsonb := $baseline$${expected}$baseline$::jsonb; BEGIN\nPERFORM pg_advisory_xact_lock(hashtextextended('orevami-inclusive-v4',0));\nIF current_user<>'postgres' THEN RAISE EXCEPTION 'Installation role mismatch'; END IF;\n${catalog.replace(' as manifest','')} INTO actual;\nIF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Closed V2 catalogue mismatch; no repair attempted'; END IF;\nIF (SELECT enabled OR registrations_enabled FROM activities_private.settings) IS DISTINCT FROM false OR EXISTS(SELECT 1 FROM activities_private.adult_access WHERE revoked_at IS NULL) THEN RAISE EXCEPTION 'Module must remain closed'; END IF;\nEND $guard$;\n`;
await writeFile(new URL('../docs/majority/004-inclusive-activities-proposal.sql',import.meta.url),guard+await read('docs/majority/inclusive-body.sql')+'\nCOMMIT;\n');
