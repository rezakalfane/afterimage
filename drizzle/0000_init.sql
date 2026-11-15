CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`is_guest` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT "app_users_guest" CHECK("app_users"."is_guest" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor_ref` text,
	`event_type` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "audit_json" CHECK(json_valid("audit_events"."metadata_json"))
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_date` ON `audit_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `character_memories` (
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`character_id` text NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL,
	`observed_revision` integer NOT NULL,
	`facts_json` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `run_id`, `character_id`),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memories_character" CHECK("character_memories"."character_id" IN ('jeanne','malik')),
	CONSTRAINT "memories_generation" CHECK("character_memories"."generation" > 0),
	CONSTRAINT "memories_json" CHECK(json_valid("character_memories"."facts_json"))
);
--> statement-breakpoint
CREATE TABLE `command_receipts` (
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`command_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `run_id`, `command_id`),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `memberships`(`tenant_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "receipts_json" CHECK(json_valid("command_receipts"."result_json"))
);
--> statement-breakpoint
CREATE TABLE `conversation_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_scope` text NOT NULL,
	`character_id` text NOT NULL,
	`external_client_id` text NOT NULL,
	`connection_id` text,
	`status` text NOT NULL,
	`status_reason` text,
	`heartbeat_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "leases_character" CHECK("conversation_leases"."character_id" IN ('jeanne','malik')),
	CONSTRAINT "leases_status" CHECK("conversation_leases"."status" IN ('reserved','active','closing','uncertain','closed','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_leases_connection_id_unique` ON `conversation_leases` (`connection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_open_lease_per_run` ON `conversation_leases` (`tenant_id`,`run_id`) WHERE status IN ('reserved','active','closing','uncertain');--> statement-breakpoint
CREATE INDEX `leases_capacity` ON `conversation_leases` (`provider_scope`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `ending_intents` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ending` text NOT NULL,
	`revision` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ending_intents_ending" CHECK("ending_intents"."ending" IN ('public_cut','sealed_archive','broken_promise'))
);
--> statement-breakpoint
CREATE TABLE `episode_versions` (
	`episode_id` text NOT NULL,
	`version` integer NOT NULL,
	`content_hash` text NOT NULL,
	`content_json` text NOT NULL,
	`published_at` integer NOT NULL,
	PRIMARY KEY(`episode_id`, `version`),
	CONSTRAINT "episode_version_pos" CHECK("episode_versions"."version" > 0),
	CONSTRAINT "episode_json" CHECK(json_valid("episode_versions"."content_json"))
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`email_normalized` text NOT NULL,
	`role` text NOT NULL,
	`created_by` text,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`consumed_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "invitations_role" CHECK("invitations"."role" IN ('owner','admin','player'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	`result_json` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_owner` text,
	`lease_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jobs_kind" CHECK("jobs"."kind" IN ('recording','cleanup','delete_media')),
	CONSTRAINT "jobs_status" CHECK("jobs"."status" IN ('pending','running','uncertain','completed','failed','cancelled')),
	CONSTRAINT "jobs_payload" CHECK(json_valid("jobs"."payload_json")),
	CONSTRAINT "jobs_result" CHECK("jobs"."result_json" IS NULL OR json_valid("jobs"."result_json")),
	CONSTRAINT "jobs_attempts" CHECK("jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX `jobs_ready` ON `jobs` (`status`,`next_attempt_at`,`lease_until`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_dedupe` ON `jobs` (`tenant_id`,`run_id`,`kind`,`dedupe_key`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memberships_role" CHECK("memberships"."role" IN ('owner','admin','player'))
);
--> statement-breakpoint
CREATE TABLE `napster_bindings` (
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`character_id` text NOT NULL,
	`generation` integer NOT NULL,
	`external_client_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `run_id`, `character_id`, `generation`),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bindings_character" CHECK("napster_bindings"."character_id" IN ('jeanne','malik')),
	CONSTRAINT "bindings_ecid_len" CHECK(length("napster_bindings"."external_client_id") BETWEEN 1 AND 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `napster_bindings_external_client_id_unique` ON `napster_bindings` (`external_client_id`);--> statement-breakpoint
CREATE TABLE `provider_budgets` (
	`scope` text PRIMARY KEY NOT NULL,
	`next_allowed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_events` (
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`revision` integer NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`channel` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `run_id`, `revision`),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`actor_user_id`) REFERENCES `memberships`(`tenant_id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "run_events_revision" CHECK("run_events"."revision" > 0),
	CONSTRAINT "run_events_json" CHECK(json_valid("run_events"."payload_json")),
	CONSTRAINT "run_events_channel" CHECK("run_events"."channel" IN ('ui','tool','ending-confirmed','rehearsal'))
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`episode_id` text NOT NULL,
	`episode_version` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`state_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`,`owner_user_id`) REFERENCES `memberships`(`tenant_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`,`episode_version`) REFERENCES `episode_versions`(`episode_id`,`version`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "runs_revision" CHECK("runs"."revision" >= 0),
	CONSTRAINT "runs_status" CHECK("runs"."status" IN ('active','finished','deleting')),
	CONSTRAINT "runs_state_json" CHECK(json_valid("runs"."state_json"))
);
--> statement-breakpoint
CREATE INDEX `runs_owner` ON `runs` (`tenant_id`,`owner_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `runs_expiry` ON `runs` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `runs_tenant_id` ON `runs` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`max_active_sessions` integer DEFAULT 2 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "tenants_status" CHECK("tenants"."status" IN ('active','suspended')),
	CONSTRAINT "tenants_public" CHECK("tenants"."is_public" IN (0,1)),
	CONSTRAINT "tenants_max_sessions" CHECK("tenants"."max_active_sessions" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`is_anonymous` integer DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);