-- Where your authors are from: one or two countries (ISO 3166-1 alpha-2, e.g. UA, GB) per author
-- name. Books show their authors' flags, and the Dashboard maps the countries you read.

create table public.author_countries (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  author      text not null check (length(author) between 1 and 200),
  countries   text[] not null check (
                cardinality(countries) between 1 and 2
                and array_to_string(countries, ',') ~ '^[A-Z]{2}(,[A-Z]{2})?$'
              ),
  updated_at  timestamptz not null default now(),
  primary key (user_id, author)
);

create trigger author_countries_set_updated_at
  before update on public.author_countries
  for each row execute function public.set_updated_at();

revoke all on public.author_countries from anon;
grant select, insert, update, delete on public.author_countries to authenticated;

alter table public.author_countries enable row level security;

create policy "own author countries: select" on public.author_countries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own author countries: insert" on public.author_countries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own author countries: update" on public.author_countries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own author countries: delete" on public.author_countries for delete to authenticated
  using ((select auth.uid()) = user_id);
