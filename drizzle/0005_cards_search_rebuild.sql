UPDATE cards SET search_id = rowid WHERE search_id IS NULL;
--> statement-breakpoint
DELETE FROM cards_fts;
--> statement-breakpoint
INSERT INTO cards_fts (rowid, card_id, user_id, title, notes, subtasks)
SELECT c.search_id, c.id, c.user_id, c.title, coalesce(c.notes, ''),
       coalesce((SELECT group_concat(text, char(10)) FROM
         (SELECT text FROM subtasks WHERE card_id = c.id ORDER BY sort_order)), '')
FROM cards c;
