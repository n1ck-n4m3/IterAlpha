CREATE TABLE `site_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_hash` text NOT NULL,
	`email` text,
	`page` text NOT NULL,
	`bucket` integer NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_visits_visitor_page_bucket` ON `site_visits` (`visitor_hash`,`page`,`bucket`);--> statement-breakpoint
CREATE INDEX `site_visits_occurred_at` ON `site_visits` (`occurred_at`);