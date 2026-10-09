-- Sell shelf: books you own and want to sell. Selling uses the existing sold_at / sale_price
-- columns; a sold book (sold_at set) leaves the library but stays on the Sell page.
alter table public.books
  add column for_sale boolean not null default false;

comment on column public.books.for_sale is 'On the sell shelf (owned, not sold yet).';
