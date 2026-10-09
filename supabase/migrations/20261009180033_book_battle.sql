-- Book battle: a yearly tournament of the books you finished, one bracket for the best and one
-- for the worst. Each row is one decision in the bracket:
--   m01..m12  the month's pick
--   q1-drop   the monthly winner knocked out first in quarter 1 (keep two of three)
--   q1..q4    the quarter's champion
--   s1, s2    semi-final winners (Q1 v Q2, Q3 v Q4)
--   final     the book of the year

create table public.book_battle_picks (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  year        int not null check (year between 1900 and 2200),
  bracket     text not null check (bracket in ('best', 'worst')),
  slot        text not null check (slot ~ '^(m(0[1-9]|1[0-2])|q[1-4](-drop)?|s[12]|final)$'),
  book_id     uuid not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, year, bracket, slot),
  foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade
);

create trigger book_battle_picks_set_updated_at
  before update on public.book_battle_picks
  for each row execute function public.set_updated_at();

revoke all on public.book_battle_picks from anon;
grant select, insert, update, delete on public.book_battle_picks to authenticated;

alter table public.book_battle_picks enable row level security;

create policy "own battle picks: select" on public.book_battle_picks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own battle picks: insert" on public.book_battle_picks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own battle picks: update" on public.book_battle_picks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own battle picks: delete" on public.book_battle_picks for delete to authenticated
  using ((select auth.uid()) = user_id);
