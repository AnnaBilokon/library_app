-- New releases: publishers' listing pages ("new", "coming soon") that an admin checks with one
-- click. Books found there become catalog drafts linked to their source, and each reader can hide
-- the ones they're not interested in.

create table public.release_sources (
  id               uuid primary key default gen_random_uuid(),
  url              text not null unique check (url ~ '^https?://'),
  label            text not null check (length(btrim(label)) > 0),
  kind             text not null default 'new' check (kind in ('new', 'coming')),
  pages            int not null default 2 check (pages between 1 and 20),
  pattern          text,                  -- how book links start (e.g. /product/); empty: guessed
  last_checked_at  timestamptz,
  created_by       uuid default auth.uid() references auth.users on delete set null,
  created_at       timestamptz not null default now()
);

revoke all on public.release_sources from anon;
grant select, insert, update, delete on public.release_sources to authenticated;
alter table public.release_sources enable row level security;

create policy "release sources: select" on public.release_sources for select to authenticated using (true);
create policy "release sources: insert" on public.release_sources for insert to authenticated with check ((select public.is_admin()));
create policy "release sources: update" on public.release_sources for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "release sources: delete" on public.release_sources for delete to authenticated using ((select public.is_admin()));

alter table public.editions add column release_source_id uuid references public.release_sources on delete set null;
create index editions_release_source_idx on public.editions (release_source_id, created_at desc) where release_source_id is not null;

alter table public.user_settings add column hidden_releases uuid[] not null default '{}';

-- A starting set; edit or remove them on the New releases page.
insert into public.release_sources (url, label, kind, pages) values
  ('https://ksd.ua/books/special/anonsy', 'КСД · Анонси', 'coming', 5),
  ('https://ksd.ua/books/special/novynky-ksd', 'КСД · Новинки', 'new', 2),
  ('https://vivat.com.ua/novynky-knyh/', 'Віват · Новинки', 'new', 1),
  ('https://vivat.com.ua/peredzamovlennia/', 'Віват · Передзамовлення', 'coming', 2),
  ('https://laboratory.ua/catalog/new-books', 'Лабораторія · Новинки', 'new', 2);
