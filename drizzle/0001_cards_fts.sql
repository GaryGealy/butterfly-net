CREATE VIRTUAL TABLE `cards_fts` USING fts5(
	card_id UNINDEXED,
	user_id UNINDEXED,
	title,
	notes,
	subtasks,
	tokenize = 'porter unicode61'
);
