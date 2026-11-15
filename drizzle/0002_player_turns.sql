CREATE TABLE `player_turns` (
	`tenant_id` text NOT NULL,
	`run_id` text NOT NULL,
	`lease_id` text NOT NULL,
	`item_id` text NOT NULL,
	`at` integer NOT NULL,
	`text_hash` text NOT NULL,
	`mentions_note` integer DEFAULT 0 NOT NULL,
	`mentions_water` integer DEFAULT 0 NOT NULL,
	`mentions_report` integer DEFAULT 0 NOT NULL,
	`mentions_future` integer DEFAULT 0 NOT NULL,
	`seat` text,
	`location` text,
	PRIMARY KEY(`lease_id`, `item_id`),
	FOREIGN KEY (`tenant_id`,`run_id`) REFERENCES `runs`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_turns_recent` ON `player_turns` (`lease_id`,`at`);