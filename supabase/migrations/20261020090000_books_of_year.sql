-- The book you chose as your book of the year, per year ({"2026": "<book id>"}), for when the
-- Book Battle isn't decided and several books share your top rating.

alter table public.user_settings add column books_of_year jsonb not null default '{}';
