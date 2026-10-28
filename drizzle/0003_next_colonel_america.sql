CREATE TABLE `spiders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spiders_owner_updated` ON `spiders` (`owner`,`updated_at`);--> statement-breakpoint
CREATE INDEX `spiders_status` ON `spiders` (`status`);