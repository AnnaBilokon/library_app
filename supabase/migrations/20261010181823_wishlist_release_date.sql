-- When a wishlist book comes out, so the app can remind you to start looking for it.
alter table public.books
  add column release_date date;

comment on column public.books.release_date is 'Wishlist: the day the book is released (null = already out or unknown).';
