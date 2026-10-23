import {readFile,writeFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './activities-test-fixture.mjs';
const db=new PGlite();
try{
 await db.exec(fixture);
 await db.exec('alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
 let sql=await readFile(new URL('../docs/production-v1/001-install-closed.sql',import.meta.url),'utf8');
 sql=sql.replace("RAISE EXCEPTION 'Installed foundation divergence: %',bad_key;",`RAISE EXCEPTION 'FUNCTION_DIFF %',(SELECT jsonb_agg(jsonb_build_object('schema',e->>'schema','name',e->>'name','args',e->>'args','expected_acl',e->>'acl','actual_acl',a->>'acl','definition_equal',e->'definition'=a->'definition')) FROM jsonb_array_elements(expected->'functions') e JOIN jsonb_array_elements(actual->'functions') a ON a->>'schema'=e->>'schema' AND a->>'name'=e->>'name' AND a->>'args'=e->>'args' WHERE a IS DISTINCT FROM e);`);
 try{await db.exec(sql);throw Error('Expected original failure');}catch(e){if(!e.message.startsWith('FUNCTION_DIFF '))throw e;const differences=JSON.parse(e.message.slice(14));await writeFile(new URL('../../../outputs/production-v1/function-divergence.json',import.meta.url),JSON.stringify(differences,null,2));console.log(JSON.stringify(differences,null,2));}
}finally{await db.close();}
