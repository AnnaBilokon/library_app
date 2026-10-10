-- Series and authors you chose not to track on the Series page (your books keep their series).
alter table public.user_settings
  add column hidden_series text[] not null default '{}',
  add column hidden_authors text[] not null default '{}';

comment on column public.user_settings.hidden_series is 'Series hidden from the series tracker.';
comment on column public.user_settings.hidden_authors is 'Authors hidden from the author collections.';
