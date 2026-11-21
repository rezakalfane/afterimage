-- The secret 2056 companion "pixo" may hold a conversation lease and a memory identity.
-- SQLite cannot alter a CHECK: recreate the two tables (nothing references them), copy, swap.
CREATE TABLE `conversation_leases_new` (
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
	`updated_at` integer NOT NULL, `locale` text DEFAULT 'fr' NOT NULL CHECK (`locale` IN ('fr','en')),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "leases_character" CHECK("conversation_leases_new"."character_id" IN ('jeanne','malik','pixo')),
	CONSTRAINT "leases_status" CHECK("conversation_leases_new"."status" IN ('reserved','active','closing','uncertain','closed','failed'))
);
--> statement-breakpoint
INSERT INTO `conversation_leases_new` SELECT `id`,`tenant_id`,`run_id`,`user_id`,`provider_scope`,`character_id`,`external_client_id`,`connection_id`,`status`,`status_reason`,`heartbeat_at`,`expires_at`,`created_at`,`updated_at`,`locale` FROM `conversation_leases`;
--> statement-breakpoint
DROP TABLE `conversation_leases`;
--> statement-breakpoint
ALTER TABLE `conversation_leases_new` RENAME TO `conversation_leases`;
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_leases_connection_id_unique` ON `conversation_leases` (`connection_id`);
--> statement-breakpoint
CREATE INDEX `leases_capacity` ON `conversation_leases` (`provider_scope`,`status`,`expires_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_open_lease_per_run_character` ON `conversation_leases` (`tenant_id`,`run_id`,`character_id`) WHERE status IN ('reserved','active','closing','uncertain');
--> statement-breakpoint
CREATE TABLE `napster_bindings_new` (
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`character_id` text NOT NULL,
	`generation` integer NOT NULL,
	`external_client_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `run_id`, `character_id`, `generation`),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bindings_character" CHECK("napster_bindings_new"."character_id" IN ('jeanne','malik','pixo')),
	CONSTRAINT "bindings_ecid_len" CHECK(length("napster_bindings_new"."external_client_id") BETWEEN 1 AND 32)
);
--> statement-breakpoint
INSERT INTO `napster_bindings_new` SELECT `tenant_id`,`run_id`,`character_id`,`generation`,`external_client_id`,`agent_id`,`created_at` FROM `napster_bindings`;
--> statement-breakpoint
DROP TABLE `napster_bindings`;
--> statement-breakpoint
ALTER TABLE `napster_bindings_new` RENAME TO `napster_bindings`;
--> statement-breakpoint
CREATE UNIQUE INDEX `napster_bindings_external_client_id_unique` ON `napster_bindings` (`external_client_id`);
