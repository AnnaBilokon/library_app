-- How many books a series has, so the series tracker can show the ones you're still missing
-- (series are named on books; this only stores the total you set for one).

create table public.series_totals (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  series      text not null check (length(series) between 1 and 200),
  total       int not null check (total between 1 and 200),
  updated_at  timestamptz not null default now(),
  primary key (user_id, series)
);

create trigger series_totals_set_updated_at
  before update on public.series_totals
  for each row execute function public.set_updated_at();

revoke all on public.series_totals from anon;
grant select, insert, update, delete on public.series_totals to authenticated;

alter table public.series_totals enable row level security;

create policy "own series totals: select" on public.series_totals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own series totals: insert" on public.series_totals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own series totals: update" on public.series_totals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own series totals: delete" on public.series_totals for delete to authenticated
  using ((select auth.uid()) = user_id);
