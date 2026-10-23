-- PROPOSAL ONLY. Requires the exact closed V2 catalogue guard generated alongside this body.
-- No settings update, account activation, test account or identity document.
ALTER TABLE activities_private.adult_access ALTER COLUMN approved_by DROP NOT NULL;
ALTER TABLE activities_private.adult_access
 ADD COLUMN verification_provider text,
 ADD COLUMN verification_session_hash text,
 ADD COLUMN verification_deadline timestamptz,
 ADD COLUMN verification_completed boolean NOT NULL DEFAULT false,
 ADD COLUMN verified_until timestamptz;
ALTER TABLE activities_private.adult_access ADD CONSTRAINT adult_automatic_proof CHECK (
 (verification_provider IS NULL AND approved_by IS NOT NULL AND verification_session_hash IS NULL AND verified_until IS NULL)
 OR (verification_provider='yoti' AND approved_by IS NULL
 AND verification_session_hash IS NOT NULL AND verification_session_hash ~ '^[a-f0-9]{64}$' AND verification_deadline IS NOT NULL
 AND (verified_until IS NULL OR verification_completed))
);
CREATE UNIQUE INDEX adult_verification_session ON activities_private.adult_access(verification_session_hash);

CREATE FUNCTION activities_private.automatic_adult(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM activities_private.adult_access WHERE user_id=target
 AND verification_provider='yoti' AND verification_completed
 AND verified_until>now() AND revoked_at IS NULL)
$$;
REVOKE ALL ON FUNCTION activities_private.automatic_adult(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION activities_private.allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.myevent_account_active()
 AND EXISTS(SELECT 1 FROM activities_private.settings WHERE enabled)
 AND activities_private.automatic_adult(auth.uid())
$$;
CREATE OR REPLACE FUNCTION activities_private.capabilities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',coalesce((SELECT enabled FROM activities_private.settings),false),
 'adult_access',auth.uid() IS NOT NULL AND public.myevent_account_active() AND activities_private.automatic_adult(auth.uid()),
 'automatic_majority',activities_private.automatic_adult(auth.uid()),
 'registrations_enabled',coalesce((SELECT registrations_enabled FROM activities_private.settings),false),
 'can_create',activities_private.allowed(),
 'can_participate',activities_private.allowed() AND coalesce((SELECT registrations_enabled FROM activities_private.settings),false),'version',3)
$$;
-- Keep existing participation locking, limits, notices and permissions. Tighten only target eligibility.
DO $$DECLARE source text; old_predicate text := 'exists(select 1 from activities_private.adult_access where user_id=target and revoked_at is null)';
BEGIN
 SELECT pg_get_functiondef('activities_private.participate(uuid,text,uuid)'::regprocedure) INTO source;
 IF position(old_predicate IN source)=0 THEN RAISE EXCEPTION 'Participation predicate drift'; END IF;
 EXECUTE replace(source,old_predicate,'activities_private.automatic_adult(target)');
END$$;

-- These privileged operations are exclusively for the trusted backend. The user's UID
-- must come from server-validated authentication, never from a submitted user_id.
CREATE FUNCTION activities_private.majority_begin(p_user uuid,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_user IS NULL OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid verification reference'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('majority:'||p_user::text,0));
 IF EXISTS(SELECT 1 FROM activities_private.adult_access WHERE user_id=p_user AND verification_provider='yoti' AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Adult access revoked'; END IF;
 IF EXISTS(SELECT 1 FROM activities_private.adult_access WHERE user_id=p_user AND approved_at>now()-interval '1 minute') THEN
  RAISE EXCEPTION 'Verification rate limited';
 END IF;
 INSERT INTO activities_private.adult_access(user_id,approved_by,approved_at,revoked_at,verification_provider,verification_session_hash,verification_deadline,verification_completed,verified_until)
 VALUES(p_user,NULL,now(),NULL,'yoti',p_hash,now()+interval '15 minutes',false,NULL)
 ON CONFLICT(user_id) DO UPDATE SET approved_by=NULL,approved_at=now(),revoked_at=NULL,verification_provider='yoti',verification_session_hash=p_hash,verification_deadline=now()+interval '15 minutes',verification_completed=false,verified_until=NULL;
END$$;
CREATE FUNCTION activities_private.majority_complete(p_user uuid,p_hash text,p_over18 boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE proof activities_private.adult_access%rowtype;
BEGIN
 SELECT * INTO proof FROM activities_private.adult_access WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR p_hash IS NULL OR proof.verification_session_hash IS DISTINCT FROM p_hash OR proof.verification_provider IS DISTINCT FROM 'yoti' THEN RAISE EXCEPTION 'Verification session mismatch'; END IF;
 -- Replays never extend a proof, reverse a rejection or undo a revocation.
 IF proof.verification_completed THEN RETURN coalesce(proof.revoked_at IS NULL AND proof.verified_until>now(),false); END IF;
 IF proof.revoked_at IS NOT NULL THEN RETURN false; END IF;
 IF proof.verification_deadline<=now() THEN RAISE EXCEPTION 'Verification session expired'; END IF;
 UPDATE activities_private.adult_access SET verification_completed=true,
 verified_until=CASE WHEN p_over18 IS TRUE THEN now()+interval '90 days' ELSE NULL END,
 approved_at=now() WHERE user_id=p_user;
 RETURN p_over18 IS TRUE;
END$$;
REVOKE ALL ON FUNCTION activities_private.majority_begin(uuid,text),activities_private.majority_complete(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA activities_private TO service_role;
GRANT EXECUTE ON FUNCTION activities_private.majority_begin(uuid,text),activities_private.majority_complete(uuid,text,boolean) TO service_role;
CREATE FUNCTION public.activities_majority_begin(p_user uuid,p_hash text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT activities_private.majority_begin(p_user,p_hash)$$;
CREATE FUNCTION public.activities_majority_complete(p_user uuid,p_hash text,p_over18 boolean) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT activities_private.majority_complete(p_user,p_hash,p_over18)$$;
REVOKE ALL ON FUNCTION public.activities_majority_begin(uuid,text),public.activities_majority_complete(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.activities_majority_begin(uuid,text),public.activities_majority_complete(uuid,text,boolean) TO service_role;
