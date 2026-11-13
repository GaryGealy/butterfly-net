ALTER TABLE `cards` ADD `search_id` integer;--> statement-breakpoint
CREATE INDEX `cards_pile_idx` ON `cards` (`pile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_search_id_idx` ON `cards` (`search_id`);--> statement-breakpoint
CREATE INDEX `subtasks_card_order_idx` ON `subtasks` (`card_id`,`sort_order`);