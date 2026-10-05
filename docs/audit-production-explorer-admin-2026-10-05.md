# Audit réel Explorer / Administration — 5 octobre 2026

Branche examinée : refactor-final, HEAD distant initial 580fedef6fbca66e203832cb040aa30f6bc02298. Comparaison des catalogues par transactions BEGIN READ ONLY / ROLLBACK : TEST ahyyknfjsielnqyoxqgh, PRODUCTION nxxvadbliinhvkirqkkl. Aucune migration distante, donnée métier, variable ou publication modifiée.

## Résultat

TEST : 16 tables du périmètre ; PRODUCTION : 7. Les colonnes des 7 tables communes concordent. Le registre supabase_migrations.schema_migrations est absent des deux environnements : la présence des objets ne prouve pas un historique de migrations. Les fonctions de membership/gestion événement sont équivalentes après normalisation ; ne pas les remplacer sur la seule base de leurs hash.

PRODUCTION possède déjà platform_admins, admin_partner_content et l’administration V1 ; un administrateur est enregistré dans chaque environnement. L’identité du propriétaire réel doit être vérifiée avant toute attribution supplémentaire. Ne pas inscrire B en production. Toutes les tables publiques Production ont RLS actif ; authenticated ne peut pas lire platform_admins, anon ne peut pas exécuter myevent_admin_overview ; le rôle d’audit peut modifier auth.users.banned_until.

## Tables absentes en production : définitions exactes observées dans TEST

### personal_reservations

RLS : true.

Colonnes :

```json
[
  {
    "name": "id",
    "type": "uuid",
    "default": "gen_random_uuid()",
    "notnull": true
  },
  {
    "name": "owner_id",
    "type": "uuid",
    "default": "auth.uid()",
    "notnull": true
  },
  {
    "name": "event_id",
    "type": "uuid",
    "default": null,
    "notnull": false
  },
  {
    "name": "kind",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "details",
    "type": "jsonb",
    "default": null,
    "notnull": true
  },
  {
    "name": "created_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  },
  {
    "name": "updated_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE INDEX personal_reservations_event ON public.personal_reservations USING btree (event_id) WHERE (event_id IS NOT NULL)
CREATE INDEX personal_reservations_owner ON public.personal_reservations USING btree (owner_id, created_at DESC)
CREATE UNIQUE INDEX personal_reservations_pkey ON public.personal_reservations USING btree (id)
```

Contraintes et policies :

```json
{
  "constraints": [
    "CHECK (((jsonb_typeof(details) = 'object'::text) AND (octet_length((details)::text) <= 300000)))",
    "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL",
    "CHECK ((kind = ANY (ARRAY['accommodation'::text, 'transport'::text, 'restaurant'::text, 'activity'::text, 'ticket'::text])))",
    "FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE",
    "PRIMARY KEY (id)"
  ],
  "policies": [
    {
      "cmd": "DELETE",
      "name": "personal_delete",
      "qual": "(owner_id = auth.uid())",
      "check": null,
      "roles": [
        "authenticated"
      ],
      "permissive": "PERMISSIVE"
    },
    {
      "cmd": "INSERT",
      "name": "personal_insert",
      "qual": null,
      "check": "((owner_id = auth.uid()) AND ((event_id IS NULL) OR event_is_manager(event_id)))",
      "roles": [
        "authenticated"
      ],
      "permissive": "PERMISSIVE"
    },
    {
      "cmd": "SELECT",
      "name": "personal_read",
      "qual": "((owner_id = auth.uid()) OR ((event_id IS NOT NULL) AND event_is_member(event_id)))",
      "check": null,
      "roles": [
        "authenticated"
      ],
      "permissive": "PERMISSIVE"
    },
    {
      "cmd": "UPDATE",
      "name": "personal_update",
      "qual": "(owner_id = auth.uid())",
      "check": "(owner_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "permissive": "PERMISSIVE"
    }
  ],
  "grants": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_v2_install_snapshot

RLS : true.

Colonnes :

```json
[
  {
    "name": "object_name",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "definition",
    "type": "text",
    "default": null,
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_v2_install_snapshot_pkey ON public.admin_v2_install_snapshot USING btree (object_name)
```

Contraintes et policies :

```json
{
  "constraints": [
    "PRIMARY KEY (object_name)"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_reports

RLS : true.

Colonnes :

```json
[
  {
    "name": "id",
    "type": "uuid",
    "default": "gen_random_uuid()",
    "notnull": true
  },
  {
    "name": "reporter_id",
    "type": "uuid",
    "default": null,
    "notnull": false
  },
  {
    "name": "target_kind",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "target_id",
    "type": "uuid",
    "default": null,
    "notnull": true
  },
  {
    "name": "reason",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "status",
    "type": "text",
    "default": "'open'::text",
    "notnull": true
  },
  {
    "name": "reviewed_by",
    "type": "uuid",
    "default": null,
    "notnull": false
  },
  {
    "name": "reviewed_at",
    "type": "timestamp with time zone",
    "default": null,
    "notnull": false
  },
  {
    "name": "created_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_reports_one_open ON public.admin_reports USING btree (reporter_id, target_kind, target_id) WHERE (status = 'open'::text)
CREATE UNIQUE INDEX admin_reports_pkey ON public.admin_reports USING btree (id)
CREATE INDEX admin_reports_queue ON public.admin_reports USING btree (status, created_at DESC)
```

Contraintes et policies :

```json
{
  "constraints": [
    "PRIMARY KEY (id)",
    "CHECK (((length(TRIM(BOTH FROM reason)) >= 10) AND (length(TRIM(BOTH FROM reason)) <= 1000)))",
    "FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL",
    "FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL",
    "CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text])))",
    "CHECK ((target_kind = ANY (ARRAY['event'::text, 'listing'::text])))"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_partner_registry

RLS : true.

Colonnes :

```json
[
  {
    "name": "provider",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "label",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "enabled",
    "type": "boolean",
    "default": "false",
    "notnull": true
  },
  {
    "name": "notes",
    "type": "text",
    "default": "''::text",
    "notnull": true
  },
  {
    "name": "updated_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_partner_registry_pkey ON public.admin_partner_registry USING btree (provider)
```

Contraintes et policies :

```json
{
  "constraints": [
    "PRIMARY KEY (provider)",
    "CHECK ((provider = ANY (ARRAY['getyourguide'::text, 'viator'::text, 'booking'::text, 'ticketnetwork'::text, 'fnac_spectacles'::text])))"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_app_settings

RLS : true.

Colonnes :

```json
[
  {
    "name": "key",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "enabled",
    "type": "boolean",
    "default": "true",
    "notnull": true
  },
  {
    "name": "description",
    "type": "text",
    "default": "''::text",
    "notnull": true
  },
  {
    "name": "updated_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_app_settings_pkey ON public.admin_app_settings USING btree (key)
```

Contraintes et policies :

```json
{
  "constraints": [
    "CHECK ((key = ANY (ARRAY['social'::text, 'events'::text, 'marketplace'::text, 'music'::text, 'games'::text, 'stories'::text])))",
    "PRIMARY KEY (key)"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_audit_log

RLS : true.

Colonnes :

```json
[
  {
    "name": "id",
    "type": "bigint",
    "default": null,
    "notnull": true
  },
  {
    "name": "actor_id",
    "type": "uuid",
    "default": null,
    "notnull": true
  },
  {
    "name": "action",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "target_kind",
    "type": "text",
    "default": null,
    "notnull": true
  },
  {
    "name": "target_id",
    "type": "uuid",
    "default": null,
    "notnull": false
  },
  {
    "name": "detail",
    "type": "jsonb",
    "default": "'{}'::jsonb",
    "notnull": true
  },
  {
    "name": "created_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_audit_log_pkey ON public.admin_audit_log USING btree (id)
CREATE INDEX admin_audit_recent ON public.admin_audit_log USING btree (created_at DESC)
```

Contraintes et policies :

```json
{
  "constraints": [
    "PRIMARY KEY (id)"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_account_controls

RLS : true.

Colonnes :

```json
[
  {
    "name": "user_id",
    "type": "uuid",
    "default": null,
    "notnull": true
  },
  {
    "name": "suspended",
    "type": "boolean",
    "default": "false",
    "notnull": true
  },
  {
    "name": "reason",
    "type": "text",
    "default": "''::text",
    "notnull": true
  },
  {
    "name": "previous_banned_until",
    "type": "timestamp with time zone",
    "default": null,
    "notnull": false
  },
  {
    "name": "managed_banned_until",
    "type": "timestamp with time zone",
    "default": null,
    "notnull": false
  },
  {
    "name": "updated_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_account_controls_pkey ON public.admin_account_controls USING btree (user_id)
```

Contraintes et policies :

```json
{
  "constraints": [
    "PRIMARY KEY (user_id)",
    "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_event_controls

RLS : true.

Colonnes :

```json
[
  {
    "name": "event_id",
    "type": "uuid",
    "default": null,
    "notnull": true
  },
  {
    "name": "hidden",
    "type": "boolean",
    "default": "false",
    "notnull": true
  },
  {
    "name": "reason",
    "type": "text",
    "default": "''::text",
    "notnull": true
  },
  {
    "name": "updated_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_event_controls_pkey ON public.admin_event_controls USING btree (event_id)
```

Contraintes et policies :

```json
{
  "constraints": [
    "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE",
    "PRIMARY KEY (event_id)"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

### admin_listing_controls

RLS : true.

Colonnes :

```json
[
  {
    "name": "listing_id",
    "type": "uuid",
    "default": null,
    "notnull": true
  },
  {
    "name": "hidden",
    "type": "boolean",
    "default": "false",
    "notnull": true
  },
  {
    "name": "reason",
    "type": "text",
    "default": "''::text",
    "notnull": true
  },
  {
    "name": "updated_at",
    "type": "timestamp with time zone",
    "default": "now()",
    "notnull": true
  }
]
```

Index :

```sql
CREATE UNIQUE INDEX admin_listing_controls_pkey ON public.admin_listing_controls USING btree (listing_id)
```

Contraintes et policies :

```json
{
  "constraints": [
    "FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE",
    "PRIMARY KEY (listing_id)"
  ],
  "policies": null,
  "grants": "{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}"
}
```

## Fonctions et triggers

Fonctions présentes dans TEST mais absentes de Production :

```json
[
  {
    "acl": "{postgres=X/postgres}",
    "hash": "5c7e316a8d16765ceb14f91dfd2f671d",
    "name": "myevent_admin_guard()",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    "hash": "a86fce8fe2b43748f685dd270fc87f25",
    "name": "myevent_api_request_guard()",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "hash": "19c49a68e289167109f7042ff8c65e54",
    "name": "myevent_suspension_gate_ready()",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": null,
    "hash": "745b1050fc1cf64a8fefce4269b28b2a",
    "name": "personal_reservation_guard()",
    "config": [
      "search_path=\"\""
    ],
    "definer": false
  },
  {
    "acl": "{postgres=X/postgres}",
    "hash": "b788ae6d6e7f4d11bec28a49fb976d85",
    "name": "myevent_admin_content_audit()",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres}",
    "hash": "7d10ce259926bbe94233162602dccc7b",
    "name": "myevent_admin_list(text,text,integer)",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres}",
    "hash": "32f444abd0279f552651718913a537df",
    "name": "myevent_admin_action(text,uuid,text,text,text)",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres}",
    "hash": "ed6b591a27384ee88399309dd2c65748",
    "name": "myevent_admin_config(text,text,boolean,text)",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres}",
    "hash": "945e468865a4a5da2b9dd7f05d51d0b6",
    "name": "myevent_report(text,uuid,text)",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres}",
    "hash": "d6e96a3f19c973d4490c5d828b7f96be",
    "name": "myevent_listing_not_hidden(uuid)",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  },
  {
    "acl": "{postgres=X/postgres,authenticated=X/postgres}",
    "hash": "7567b8aebc5985a69b5053bc11b0881e",
    "name": "myevent_account_active()",
    "config": [
      "search_path=\"\""
    ],
    "definer": true
  }
]
```

Triggers observés TEST / Production (comparaison complète du périmètre) :

```json
{
  "test": [
    {
      "table": "events",
      "definition": "CREATE TRIGGER event_protect_identity_v2 BEFORE DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION event_protect_identity()"
    },
    {
      "table": "personal_reservations",
      "definition": "CREATE TRIGGER personal_reservation_guard BEFORE INSERT OR UPDATE ON public.personal_reservations FOR EACH ROW EXECUTE FUNCTION personal_reservation_guard()"
    },
    {
      "table": "admin_partner_content",
      "definition": "CREATE TRIGGER myevent_admin_content_audit_v2 AFTER INSERT OR UPDATE ON public.admin_partner_content FOR EACH ROW EXECUTE FUNCTION myevent_admin_content_audit()"
    }
  ],
  "production": [
    {
      "table": "events",
      "definition": "CREATE TRIGGER event_protect_identity_v2 BEFORE DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION event_protect_identity()"
    }
  ]
}
```

## Policies administratives

Policies de TEST et Production : noms, tables et expressions exactes. Les policies admin_account_active_v2 sont restrictives et doivent préserver les policies métier existantes.

```json
{
  "test": [
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "objects",
      "schema": "storage",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_feed_posts",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_fund_entries",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_fund_payment_details",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_fund_settings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_hall_settings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_locations",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_members",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_music_settings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_outing_plan_items",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_outing_plan_reservations",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_outing_plans",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_outings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_supplies",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_supply_contributions",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_task_assignees",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "event_tasks",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "events",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "feed_comments",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "feed_likes",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "friendships",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "media",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "message_reactions",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "message_reads",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "messages",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "poll_options",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "poll_votes",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "polls",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "profiles",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "social_posts",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "voice_messages",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "marketplace_listings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_listing_publish_v2",
      "qual": "true",
      "check": "((status <> 'active'::text) OR myevent_listing_not_hidden(id))",
      "table": "marketplace_listings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_listing_visibility_v2",
      "qual": "((owner_id = auth.uid()) OR myevent_listing_not_hidden(id))",
      "check": null,
      "table": "marketplace_listings",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "marketplace_favorites",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "marketplace_threads",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    },
    {
      "name": "admin_account_active_v2",
      "qual": "( SELECT myevent_account_active() AS myevent_account_active)",
      "check": "( SELECT myevent_account_active() AS myevent_account_active)",
      "table": "marketplace_messages",
      "schema": "public",
      "permissive": "RESTRICTIVE"
    }
  ],
  "production": null
}
```

## Migrations à préparer, pas à exécuter maintenant

1. Ne pas rejouer Admin V1 001/002 : objets et propriétaire déjà présents. Préparer uniquement Admin V2 003, après revue de ses préconditions et sauvegarde des fonctions/policies/triggers existants.
2. Préparer 202610050001_personal_reservations.sql : table personnelle, event_id nullable, contrôle propriétaire/membre, rattachement sans duplication, triggers et index.
3. Préparer 202610050002_admin_v3_dashboard_reservations.sql après les dépendances V2. Ses quatre nouvelles RPC (identity, statistics, reservations, user_detail) sont actuellement absentes de TEST ET Production. La syntaxe invalide des délimiteurs a été corrigée localement ; installer et valider sur TEST avant toute demande Production.
4. Admin 004 est un gate séparé : aucun hook pgrst.db_pre_request actif dans les deux environnements. Conserver la suspension indisponible tant que le gate et les refus HTTP/PostgREST/Storage ne sont pas réellement validés, y compris personal_reservations.

## Variables Vercel observées

Production : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SNCF_API_TOKEN, OPENAI_API_KEY, VIATOR_API_KEY, VIATOR_API_ENV, YOUTUBE_API_KEY. SUPABASE_PUBLISHABLE_KEY manque. Preview refactor-final : SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MYEVENT_TEST_SUPABASE_REF, OPENAI_API_KEY ; YOUTUBE_API_KEY existe aussi au niveau Preview général. Valeurs secrètes non reproduites.

Après autorisation, ajouter uniquement la clé publishable publique du projet réel au scope Production, confirmer SUPABASE_URL, préserver tous les autres secrets ; ne pas copier les valeurs TEST, ne pas changer VERCEL_ENV et ne jamais exposer service_role. Un artefact Preview TEST garde sa configuration : ne pas le promouvoir tel quel. Une future candidate doit être reconstruite avec les variables Production, sans modifier l’alias public, puis validée avant promotion séparément autorisée. Aucun nouveau projet ni Preview spéciale consultation requis par cet audit.

## Partenaires et compatibilité

Hotels.com, Expedia Séjours, Abritel, Omio, Expedia Vols : snippets et identifiants affiliés contrôlés par les tests ciblés. Viator et les API historiques sont préservés ; les changements récents Admin V3 sont conservés. Les tests ne prouvent pas une disponibilité contractuelle externe ni une réservation réelle. Aucun nouvel endpoint Vercel ajouté par cet audit.

## Autorisations et ordre futur

Sauvegarder et vérifier une restauration, exporter définitions/RLS/ACL/hooks/contraintes et données administratives ; valider d’abord Admin V3 corrigée sur TEST. Après autorisation spécifique Production : recontrôler le catalogue, appliquer les seuls écarts nécessaires en transactions et vérifier les droits utilisateur/membre/extérieur, justificatifs et persistance. Vérifier le propriétaire existant avec une session réelle et myevent_admin_identity ; n’attribuer un rôle supplémentaire que si l’absence est démontrée et explicitement autorisée. Ajouter la variable publishable Production sous autorisation distincte. Construire et tester une candidate sans alias public, maximum 12 fonctions, iPhone Safari et partenaires ; promotion publique uniquement après feu vert distinct.

Les opérations qui modifieraient Production sont : migrations 003 / personal 001 / V3 002 (et éventuellement 004 après gate), éventuelle attribution UUID administrateur, données de tests réels, modification de variable Production, construction/déploiement candidat et promotion publique. Aucune n’a été exécutée.

## Retour arrière

Avant COMMIT : ROLLBACK. Après COMMIT : garder les données nouvelles, restaurer seulement les définitions/ACL/policies/triggers touchés depuis le snapshot Production ; aucun DROP CASCADE. Ne jamais retirer l’administrateur préexistant. Une ancienne contrainte fournisseur ne peut être restaurée si de nouveaux fournisseurs y contreviennent : conserver/archiver explicitement ces lignes avant toute restauration de contrainte. Restaurer uniquement le hook changé, sans écraser un hook antérieur. Ne pas réactiver automatiquement des comptes suspendus. Une restauration complète demande arrêt des écritures et récupération des données post-sauvegarde pour éviter leur perte. Le déploiement GiSMHGJAhBATPy4KDEzFK9j59cNH reste le retour applicatif de référence ; actuellement inchangé. Un revert Git ne restaure pas la base.

## Vérifications exécutées lors de la reprise

38 tests ciblés réussis (Admin V3 SQL réel en PGlite, préflight, Explorer, réservations, widgets et affiliations). Suite Admin V2.1 : 170 contrôles réussis. Scénarios RLS Explorer réussis (propriétaire, membre, extérieur, anonyme, rattachement unique et justificatifs). Build Vercel local target Preview réussi, 12 fonctions ; avertissement du worker de recherche de version sans échec de compilation. Aucun déploiement lancé. git diff --check réussi. Ces tests locaux ne remplacent pas la validation HTTP Admin V3 sur TEST ni les contrôles iPhone réel.
