-- Application reference schema; NOT Better Auth's schema.
-- Generate Better Auth tables from the pinned library, then integrate via migrations.
-- SQLite/libSQL: composite constraints help integrity; authorization remains mandatory.
PRAGMA foreign_keys = ON;
CREATE TABLE app_users (
 id TEXT PRIMARY KEY NOT NULL,
 is_guest INTEGER NOT NULL DEFAULT 0 CHECK (is_guest IN (0,1)),
 created_at INTEGER NOT NULL
);
CREATE TABLE tenants (
 id TEXT PRIMARY KEY NOT NULL,
 slug TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 max_active_sessions INTEGER NOT NULL DEFAULT 2 CHECK(max_active_sessions BETWEEN 0 AND 100),
 created_at INTEGER NOT NULL
);
CREATE TABLE memberships (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','player')),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE episode_versions (
 episode_id TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 content_hash TEXT NOT NULL,
 content_json TEXT NOT NULL CHECK(json_valid(content_json)),
 published_at INTEGER NOT NULL,
 PRIMARY KEY(episode_id,version)
);
CREATE TABLE runs (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL,
 episode_id TEXT NOT NULL,
 episode_version INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finished','deleting')),
 state_json TEXT NOT NULL CHECK(json_valid(state_json)),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,owner_user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(episode_id,episode_version) REFERENCES episode_versions(episode_id,version)
);
CREATE INDEX runs_owner ON runs(tenant_id,owner_user_id,updated_at);
CREATE INDEX runs_expiry ON runs(expires_at);
CREATE TABLE run_events (
 tenant_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 type TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 actor_user_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,run_id,revision),
 FOREIGN KEY(tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,actor_user_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE command_receipts (
 tenant_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 command_id TEXT NOT NULL,
 actor_user_id TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,run_id,command_id),
 FOREIGN KEY(tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,actor_user_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE character_memories (
 tenant_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 character_id TEXT NOT NULL CHECK(character_id IN ('jeanne','malik')),
 generation INTEGER NOT NULL DEFAULT 1 CHECK(generation>0),
 observed_revision INTEGER NOT NULL CHECK(observed_revision>=0),
 facts_json TEXT NOT NULL CHECK(json_valid(facts_json)),
 summary TEXT NOT NULL DEFAULT '',
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,run_id,character_id),
 FOREIGN KEY(tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE napster_bindings (
 tenant_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 character_id TEXT NOT NULL CHECK(character_id IN ('jeanne','malik')),
 generation INTEGER NOT NULL CHECK(generation>0),
 external_client_id TEXT UNIQUE NOT NULL CHECK(length(external_client_id) BETWEEN 1 AND 32),
 agent_id TEXT NOT NULL,
 companion_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,run_id,character_id,generation),
 FOREIGN KEY(tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE conversation_leases (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 provider_scope TEXT NOT NULL,
 character_id TEXT NOT NULL CHECK(character_id IN ('jeanne','malik')),
 connection_id TEXT UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('reserved','active','closing','uncertain','closed','failed')),
 heartbeat_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX one_open_lease_per_run ON conversation_leases(tenant_id,run_id)
 WHERE status IN ('reserved','active','closing','uncertain');
CREATE INDEX leases_capacity ON conversation_leases(provider_scope,status,expires_at);
CREATE TABLE provider_budgets (
 scope TEXT PRIMARY KEY NOT NULL,
 next_allowed_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE jobs (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('recording','cleanup','delete_media')),
 dedupe_key TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','running','uncertain','completed','failed','cancelled')),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at INTEGER NOT NULL,
 lease_owner TEXT,
 lease_until INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(tenant_id,run_id,kind,dedupe_key),
 FOREIGN KEY(tenant_id,run_id) REFERENCES runs(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX jobs_ready ON jobs(status,next_attempt_at,lease_until);
CREATE TABLE invitations (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 token_hash TEXT UNIQUE NOT NULL,
 email_normalized TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','player')),
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 actor_ref TEXT,
 event_type TEXT NOT NULL,
 metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)),
 created_at INTEGER NOT NULL
);
CREATE INDEX audit_tenant_date ON audit_events(tenant_id,created_at);
-- Finish provider cleanup BEFORE deleting runs; use status='deleting' as a tombstone.
-- Retain a non-personal global operations task if external cleanup must outlive a run.
-- Quota count + lease insertion + provider budget reservation require ONE write transaction.
-- No schema constraint substitutes for tenant + owner authorization in every query.
