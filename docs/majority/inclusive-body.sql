-- Supersedes the uninstalled Yoti V3 proposal. Target: exact installed closed V2.
-- Existing activities default to restricted until reviewed. New ordinary activities do not.
ALTER TABLE activities_private.activities ADD COLUMN adults_only boolean NOT NULL DEFAULT true;
CREATE FUNCTION activities_private.adult_eligible(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM activities_private.adult_access WHERE user_id=target AND revoked_at IS NULL)
$$;
REVOKE ALL ON FUNCTION activities_private.adult_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION activities_private.allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.myevent_account_active()
 AND EXISTS(SELECT 1 FROM activities_private.settings WHERE enabled)
$$;
CREATE OR REPLACE FUNCTION activities_private.capabilities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',4,'enabled',coalesce((SELECT enabled FROM activities_private.settings),false),
 'account_access',auth.uid() IS NOT NULL AND public.myevent_account_active(),
 'adult_access',activities_private.adult_eligible(auth.uid()),
 'protected_participation',NOT activities_private.adult_eligible(auth.uid()),
 'can_create',activities_private.allowed(),
 'registrations_enabled',coalesce((SELECT registrations_enabled FROM activities_private.settings),false),
 'can_participate',activities_private.allowed() AND coalesce((SELECT registrations_enabled FROM activities_private.settings),false))
$$;
-- Edit existing implementations rather than duplicating RPCs, locks or persistence.
DO $$DECLARE source text; BEGIN
 SELECT pg_get_functiondef('activities_private.visible(uuid)'::regprocedure) INTO source;
 IF position('a.id=p_id and a.status' IN source)=0 THEN RAISE EXCEPTION 'Visibility drift'; END IF;
 EXECUTE replace(source,'a.id=p_id and a.status','a.id=p_id and (not a.adults_only or activities_private.adult_eligible(auth.uid())) and a.status');

 SELECT pg_get_functiondef('activities_private.save(uuid,jsonb)'::regprocedure) INTO source;
 IF position('cost_details)' IN source)=0 OR position('if (p_data->>''starts_at'')' IN source)=0 THEN RAISE EXCEPTION 'Save drift'; END IF;
 source:=replace(source,'if (p_data->>''starts_at'')',
 $code$if p_id is not null and a.adults_only is distinct from (coalesce((p_data->>'adults_only')::boolean,false) or coalesce(p_data->>'activity_type'='aperitif',false)) then raise exception 'Créez une nouvelle activité pour changer la restriction adulte'; end if;
 if (coalesce((p_data->>'adults_only')::boolean,false) or coalesce(p_data->>'activity_type'='aperitif',false)) and not activities_private.adult_eligible(me) then raise exception 'Activité réservée aux adultes : accès adulte requis'; end if;
 if (p_data->>'starts_at')$code$);
 source:=replace(source,'conditions,activity_type,venue_cost_status,cost_details)','conditions,activity_type,venue_cost_status,cost_details,adults_only)');
 source:=replace(source,$old$coalesce(p_data->>'cost_details',''))$old$,
 $new$coalesce(p_data->>'cost_details',''),coalesce((p_data->>'adults_only')::boolean,false) or coalesce(p_data->>'activity_type'='aperitif',false))$new$);
 -- No permission to relabel an existing restricted outing through an ordinary edit.
 EXECUTE replace(source,'Accès adulte non autorisé','Compte non autorisé');

 SELECT pg_get_functiondef('activities_private.participate(uuid,text,uuid)'::regprocedure) INTO source;
 IF position('if a.status<>' IN source)=0 OR position('if not exists(select 1 from activities_private.adult_access where user_id=target and revoked_at is null)' IN source)=0 THEN RAISE EXCEPTION 'Participation drift'; END IF;
 source:=replace(source,'if a.status<>', $code$if p_action in ('join','accept') and a.adults_only and not activities_private.adult_eligible(target) then raise exception 'Activité réservée aux adultes'; end if;
 if a.status<>$code$);
 source:=replace(source,'if not exists(select 1 from activities_private.adult_access where user_id=target and revoked_at is null)', 'if a.adults_only and not activities_private.adult_eligible(target)');
 source:=replace(source,'a.join_mode=''direct''','(a.join_mode=''direct'' and activities_private.adult_eligible(me))');
 source:=replace(source,'a.join_mode=''approval''','(a.join_mode=''approval'' or not activities_private.adult_eligible(me))');
 EXECUTE replace(source,'Accès adulte non autorisé','Compte non autorisé');

 SELECT pg_get_functiondef('activities_private.detail(uuid)'::regprocedure) INTO source;
 IF position('case when accepted then l.address' IN source)=0 OR position('case when accepted then jsonb_build_object' IN source)=0 THEN RAISE EXCEPTION 'Detail drift'; END IF;
 source:=replace(source,'case when accepted then l.address','case when accepted and (owner or activities_private.adult_eligible(me)) then l.address');
 source:=replace(source,'case when accepted then jsonb_build_object','case when accepted and (owner or activities_private.adult_eligible(me)) then jsonb_build_object');
 EXECUTE source;
END$$;
-- No enabling settings, no granting adult status, no new public RPC, no RLS change.
