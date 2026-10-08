-- Initial schema for the personal book library.
-- Every row belongs to a user, and RLS lets each user see only their own rows.

-- ───────────────────────── Types ─────────────────────────

create type public.book_status as enum ('to-read', 'reading', 'paused', 'finished', 'abandoned');
create type public.book_format as enum ('paper', 'ebook', 'audio');
create type public.wish_priority as enum ('low', 'medium', 'high');
create type public.reading_outcome as enum ('finished', 'abandoned');

-- ───────────────────────── Helpers ─────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────── books ─────────────────────────

create table public.books (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,

  title             text not null check (length(btrim(title)) > 0),
  authors           text[] not null default '{}',
  status            public.book_status not null default 'to-read',
  favorite          boolean not null default false,
  rating            numeric(2,1) check (rating between 0 and 5),

  cover_path        text,                 -- object path in the public 'covers' bucket
  cover_url         text,                 -- external fallback (lookup result)

  isbn              text check (isbn ~ '^[0-9]{13}$'),   -- normalised to ISBN-13, digits only
  genres            text[] not null default '{}',
  tags              text[] not null default '{}',
  language          text check (language ~ '^[a-z]{2,3}$'),          -- ISO 639 code, e.g. 'uk'
  original_language text check (original_language ~ '^[a-z]{2,3}$'),
  format            public.book_format,
  publisher         text,
  published_year    int check (published_year between 0 and 2100),
  pages             int check (pages > 0),
  series            text,
  series_index      numeric,
  notes             text,

  -- ownership
  owned             boolean not null default false,
  acquired_at       date,
  purchase_price    numeric(10,2) check (purchase_price >= 0),
  sold_at           date,
  sale_price        numeric(10,2) check (sale_price >= 0),
  currency          text not null default 'UAH' check (currency ~ '^[A-Z]{3}$'),

  -- wishlist ("want to buy"), independent of reading status
  wanted            boolean not null default false,
  priority          public.wish_priority,
  wish_price        numeric(10,2) check (wish_price >= 0),
  where_to_buy      text,
  wishlist_reason   text,

  -- bookkeeping
  notion_page_id    text unique,          -- set by the Notion import; makes it re-runnable
  deleted_at        timestamptz,          -- soft delete (trash)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (id, user_id)                    -- target for readings' composite FK
);

create index books_user_status_idx on public.books (user_id, status) where deleted_at is null;
create unique index books_user_isbn_key on public.books (user_id, isbn)
  where isbn is not null and deleted_at is null;

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ───────────────────────── readings ─────────────────────────
-- One row per time a book is read, so re-reads count separately in the stats.
-- outcome is null while the reading is in progress or paused.

create table public.readings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  book_id      uuid not null,
  started_at   date,
  finished_at  date,
  outcome      public.reading_outcome,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- the reading must belong to a book of the same user
  foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade,
  check (finished_at is null or started_at is null or finished_at >= started_at),
  check (finished_at is null or outcome is not null)
);

create index readings_book_idx on public.readings (book_id);
create index readings_user_finished_idx on public.readings (user_id, finished_at);

create trigger readings_set_updated_at
  before update on public.readings
  for each row execute function public.set_updated_at();

-- ───────────────────────── user_settings ─────────────────────────

create table public.user_settings (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  yearly_goal  int not null default 24 check (yearly_goal > 0),
  updated_at   timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ───────────────────────── Access ─────────────────────────
-- Only signed-in users can reach these tables, and only their own rows.

revoke all on public.books, public.readings, public.user_settings from anon;
grant select, insert, update, delete on public.books, public.readings, public.user_settings to authenticated;

alter table public.books enable row level security;
alter table public.readings enable row level security;
alter table public.user_settings enable row level security;

create policy "own books: select" on public.books for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own books: insert" on public.books for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own books: update" on public.books for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own books: delete" on public.books for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "own readings: select" on public.readings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own readings: insert" on public.readings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own readings: update" on public.readings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own readings: delete" on public.readings for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "own settings: select" on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own settings: insert" on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own settings: update" on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ───────────────────────── Storage: covers ─────────────────────────
-- Public-read bucket: anyone with an object's (unguessable) URL can view it.
-- Writes are limited to the owner's folder: covers/<user_id>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

create policy "covers: owner can list" on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: owner can upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: owner can update" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: owner can delete" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
