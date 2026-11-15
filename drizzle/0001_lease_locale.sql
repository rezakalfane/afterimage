-- Additive: session locale on conversation leases (selects the agent and tool-output language).
-- Hand-written: drizzle-kit generated a table rebuild that SELECTed the not-yet-existing column.
ALTER TABLE `conversation_leases` ADD `locale` text DEFAULT 'fr' NOT NULL CHECK (`locale` IN ('fr','en'));
