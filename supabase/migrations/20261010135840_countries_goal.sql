-- "Read around the world": how many countries you'd like to have read authors from (all time).
alter table public.user_settings
  add column countries_goal int check (countries_goal between 1 and 250);

comment on column public.user_settings.countries_goal is 'Read around the world goal: number of countries (null = no goal).';
