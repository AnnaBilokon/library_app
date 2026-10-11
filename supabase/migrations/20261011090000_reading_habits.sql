-- Reading habits ("non-fiction, 3 times a week, at least 15 minutes") and the sessions you log
-- for them. A week counts as done when enough days have a session of at least the minimum.

create table public.habits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  name               text not null check (length(name) between 1 and 100),
  sessions_per_week  int not null check (sessions_per_week between 1 and 7),
  min_minutes        int not null check (min_minutes between 1 and 600),
  -- Optional: books in any of these genres, or one book, are what the habit is about.
  genres             text[] not null default '{}',
  book_id            uuid references public.books on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  archived_at        timestamptz
);

create table public.habit_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id    uuid not null references public.habits on delete cascade,
  date        date not null,
  minutes     int not null check (minutes between 1 and 1440),
  book_id     uuid references public.books on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One entry per habit and day; logging again the same day adds minutes to it.
  unique (habit_id, date)
);

create index habit_sessions_user_date on public.habit_sessions (user_id, date);

create trigger habits_set_updated_at before update on public.habits
  for each row execute function public.set_updated_at();
create trigger habit_sessions_set_updated_at before update on public.habit_sessions
  for each row execute function public.set_updated_at();

revoke all on public.habits, public.habit_sessions from anon;
grant select, insert, update, delete on public.habits, public.habit_sessions to authenticated;

alter table public.habits enable row level security;
alter table public.habit_sessions enable row level security;

create policy "own habits: select" on public.habits for select to authenticated using ((select auth.uid()) = user_id);
create policy "own habits: insert" on public.habits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own habits: update" on public.habits for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own habits: delete" on public.habits for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own habit sessions: select" on public.habit_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own habit sessions: insert" on public.habit_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own habit sessions: update" on public.habit_sessions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own habit sessions: delete" on public.habit_sessions for delete to authenticated using ((select auth.uid()) = user_id);
