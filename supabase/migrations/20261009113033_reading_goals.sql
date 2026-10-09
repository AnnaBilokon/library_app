-- Yearly reading challenge: one goal (number of books) per user per year.

create table public.reading_goals (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  year        int not null check (year between 1900 and 2200),
  goal        int not null check (goal between 1 and 1000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, year)
);

create trigger reading_goals_set_updated_at
  before update on public.reading_goals
  for each row execute function public.set_updated_at();

revoke all on public.reading_goals from anon;
grant select, insert, update, delete on public.reading_goals to authenticated;

alter table public.reading_goals enable row level security;

create policy "own goals: select" on public.reading_goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own goals: insert" on public.reading_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own goals: update" on public.reading_goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own goals: delete" on public.reading_goals for delete to authenticated
  using ((select auth.uid()) = user_id);
