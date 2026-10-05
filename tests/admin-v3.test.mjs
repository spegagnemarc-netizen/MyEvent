import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('js/admin-runtime.js','utf8');
const sql=fs.readFileSync('supabase/migrations/202610050002_admin_v3_dashboard_reservations.sql','utf8');

test('Admin V3 exposes dashboard, user detail and reservation UI',()=>{
 assert.match(html,/data-admin-tab="reservations"/);
 assert.match(html,/id="myeventAdminReservations"/);
 assert.match(js,/myevent_admin_user_detail/);
 assert.match(js,/myevent_admin_reservations/);
 assert.match(js,/Nouveaux 24 h/);
});

test('Admin V3 RPCs remain guarded and do not return proof payloads',()=>{
 assert.match(sql,/perform public\.myevent_admin_guard\(\)/);
 assert.match(sql,/new_users_24h/);
 assert.match(sql,/to_regclass\('public\.personal_reservations'\)/);
 assert.match(sql,/has_proof/);
 assert.doesNotMatch(sql,/select\s+.*details\s*,/i);
 assert.doesNotMatch(js,/proof\.base64|details\.proof|base64/i);
});

test('Admin V3 does not hardcode the production owner UUID',()=>{
 const owner='40621412-0f4c-4bed-85b6-fac57d3b3144';
 assert.equal(html.includes(owner),false);
 assert.equal(js.includes(owner),false);
 assert.equal(sql.includes(owner),false);
});
