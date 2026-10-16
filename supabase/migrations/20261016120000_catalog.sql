-- Shared book catalog. One row per edition (usually one ISBN), readable by everyone signed in and
-- managed by admins. Each person's book keeps its own copy of the details and links here through
-- books.edition_id; adding or fixing an edition never changes someone's book on its own.
-- Admins are users with app_metadata.role = 'admin' (set with `pnpm catalog:seed --make-admin`).

create extension if not exists pg_trgm with schema extensions;

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create type public.edition_status as enum ('draft', 'public');

create table public.editions (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (length(btrim(title)) > 0),
  authors           text[] not null default '{}',
  isbn              text check (isbn ~ '^[0-9]{13}$'),               -- ISBN-13, digits only
  language          text check (language ~ '^[a-z]{2,3}$'),
  original_language text check (original_language ~ '^[a-z]{2,3}$'),
  publisher         text,
  published_year    int check (published_year between 0 and 2100),
  pages             int check (pages > 0),
  series            text,
  series_index      numeric,
  genres            text[] not null default '{}',
  description       text,
  cover_path        text,                 -- object path in the 'covers' bucket, under catalog/
  cover_url         text,                 -- external fallback
  source_url        text,                 -- the page the details came from, if any
  status            public.edition_status not null default 'draft',
  created_by        uuid default auth.uid() references auth.users on delete set null,
  -- Lower-cased title, authors, publisher, series and ISBN, for search (kept by a trigger).
  search_text       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index editions_isbn_key on public.editions (isbn) where isbn is not null;
create index editions_status_idx on public.editions (status);
create index editions_search_idx on public.editions using gin (search_text extensions.gin_trgm_ops);

create function public.editions_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text = lower(concat_ws(' ', new.title, array_to_string(new.authors, ' '), new.publisher, new.series, new.isbn));
  return new;
end;
$$;

create trigger editions_set_search_text before insert or update on public.editions
  for each row execute function public.editions_set_search_text();
create trigger editions_set_updated_at before update on public.editions
  for each row execute function public.set_updated_at();

alter table public.books add column edition_id uuid references public.editions on delete set null;
create index books_edition_idx on public.books (edition_id);

-- ───────────────────────── Access ─────────────────────────
-- Everyone signed in sees public editions and their own drafts; anyone may suggest a draft;
-- only admins publish, edit and delete.

revoke all on public.editions from anon;
grant select, insert, update, delete on public.editions to authenticated;
alter table public.editions enable row level security;

create policy "editions: select" on public.editions for select to authenticated
  using (status = 'public' or created_by = (select auth.uid()) or (select public.is_admin()));
create policy "editions: insert" on public.editions for insert to authenticated
  with check (created_by = (select auth.uid()) and (status = 'draft' or (select public.is_admin())));
create policy "editions: update" on public.editions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "editions: delete" on public.editions for delete to authenticated
  using ((select public.is_admin()));

-- How many people's books link to each edition. Admins only: it reads across everyone's books.
create function public.edition_copies(edition_ids uuid[])
returns table (edition_id uuid, copies bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select b.edition_id, count(*)
    from public.books b
    where b.edition_id = any(edition_ids) and b.deleted_at is null
    group by b.edition_id;
end;
$$;

-- Move every book linked to `source` onto `target`, then delete `source`. Admins only.
-- Returns the source's cover path, so the caller can remove the file.
create function public.merge_editions(source uuid, target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_cover text;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if source = target then
    raise exception 'cannot merge an edition into itself';
  end if;
  if not exists (select 1 from public.editions where id = target) then
    raise exception 'target edition not found';
  end if;
  update public.books set edition_id = target where edition_id = source;
  delete from public.editions where id = source returning cover_path into old_cover;
  return old_cover;
end;
$$;

revoke execute on function public.edition_copies(uuid[]) from public, anon;
revoke execute on function public.merge_editions(uuid, uuid) from public, anon;
grant execute on function public.edition_copies(uuid[]) to authenticated;
grant execute on function public.merge_editions(uuid, uuid) to authenticated;

-- Catalog covers live in covers/catalog/…; anyone can view them (public bucket), admins write.
create policy "covers: admins list catalog" on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = 'catalog' and (select public.is_admin()));
create policy "covers: admins upload to catalog" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = 'catalog' and (select public.is_admin()));
create policy "covers: admins update catalog" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = 'catalog' and (select public.is_admin()));
create policy "covers: admins delete from catalog" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = 'catalog' and (select public.is_admin()));
