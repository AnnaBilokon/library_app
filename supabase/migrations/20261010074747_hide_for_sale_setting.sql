-- Setting: hide books on the sell shelf from the Library (they stay on the Sell page).
alter table public.user_settings
  add column hide_for_sale boolean not null default false;

comment on column public.user_settings.hide_for_sale is 'Hide books on the sell shelf from the Library.';
