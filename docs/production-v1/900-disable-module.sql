-- PROPOSAL ONLY. Production nxxvadbliinhvkirqkkl; emergency closure requires explicit approval.
-- No deletion. Preserve activities, adult approvals and memberships.
BEGIN;
SET LOCAL lock_timeout='5s';
UPDATE activities_private.settings SET enabled=false, registrations_enabled=false WHERE id;
COMMIT;
