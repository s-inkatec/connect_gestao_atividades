CREATE TABLE `app_users` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`permission` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_seen` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_user_id_unique` ON `app_users` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`actor` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
