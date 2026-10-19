CREATE TABLE `coach_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`session_id` text NOT NULL,
	`question` text NOT NULL,
	`status` text NOT NULL,
	`response` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coach_owner_created` ON `coach_requests` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `coach_session` ON `coach_requests` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`scene_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_owner_updated` ON `sessions` (`owner`,`updated_at`);