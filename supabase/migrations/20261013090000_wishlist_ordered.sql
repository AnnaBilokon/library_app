-- Wishlist books you've ordered and are waiting for: they sit in their own box until they arrive.
alter table public.books
  add column ordered_at date;

comment on column public.books.ordered_at is 'Wishlist: the day you ordered it (null = not ordered). Cleared when it arrives (marked bought).';
