CREATE TABLE `early_access_signups` (
	`email` text PRIMARY KEY NOT NULL,
	`track` text NOT NULL,
	`source` text NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
