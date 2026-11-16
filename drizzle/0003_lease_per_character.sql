-- Both characters of a run may be connected at once (the other era waits muted): one open lease
-- per run AND character instead of per run. Hand-written (drizzle-kit rebuilds the table).
DROP INDEX IF EXISTS `one_open_lease_per_run`;--> statement-breakpoint
CREATE UNIQUE INDEX `one_open_lease_per_run_character` ON `conversation_leases` (`tenant_id`,`run_id`,`character_id`) WHERE status IN ('reserved','active','closing','uncertain');
