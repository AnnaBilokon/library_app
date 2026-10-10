-- The Forgotten box: books you picked yourself so "Surprise me" can remind you of them.
alter table public.books
  add column forgotten boolean not null default false;

comment on column public.books.forgotten is 'In the Forgotten box (Surprise me can pick from it); cleared when you start or finish the book.';
