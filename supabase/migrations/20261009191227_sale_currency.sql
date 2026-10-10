-- Selling in another currency (e.g. SEK) than the book's (e.g. UAH): keep what you actually got.
-- sale_price stays in the book's currency (converted at the National Bank of Ukraine rate when
-- sold) so totals add up; these two hold the original amount and its currency.
alter table public.books
  add column sale_original_price numeric(10,2) check (sale_original_price >= 0),
  add column sale_original_currency text check (sale_original_currency ~ '^[A-Z]{3}$');

comment on column public.books.sale_original_price is 'What the book sold for, in sale_original_currency (null when sold in the book''s currency).';
