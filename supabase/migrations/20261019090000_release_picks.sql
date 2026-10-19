-- Release dates on catalog editions, and "picks for you": new releases the daily check (or a
-- manual check) found likely to interest a reader, each with a one-line reason.

alter table public.editions add column release_date date;   -- the day it comes out, when the page says
alter table public.editions add column release_note text;   -- the publisher's own words otherwise ("очікується наприкінці 2026 року")

create table public.release_picks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  edition_id  uuid not null references public.editions on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  seen_at     timestamptz,
  -- The same book is suggested to someone at most once.
  unique (user_id, edition_id)
);

create index release_picks_unseen_idx on public.release_picks (user_id, created_at desc) where seen_at is null;

revoke all on public.release_picks from anon;
grant select, insert, update, delete on public.release_picks to authenticated;
alter table public.release_picks enable row level security;

-- Your own picks only. The daily job writes them with the secret key; a manual check writes
-- yours as you.
create policy "own release picks: select" on public.release_picks for select to authenticated using ((select auth.uid()) = user_id);
create policy "own release picks: insert" on public.release_picks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own release picks: update" on public.release_picks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own release picks: delete" on public.release_picks for delete to authenticated using ((select auth.uid()) = user_id);
