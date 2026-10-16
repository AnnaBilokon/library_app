-- Review queue for the catalog. An edition made because someone added a book (theirs, or an
-- admin's) waits for an admin's review; editions made or saved in the admin panel count as
-- reviewed. Everything already in the catalog was checked when it was seeded, so it counts as
-- reviewed too.

alter table public.editions add column reviewed_at timestamptz;

update public.editions set reviewed_at = now();

create index editions_to_review_idx on public.editions (created_at desc) where reviewed_at is null;
