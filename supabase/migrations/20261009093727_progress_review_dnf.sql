-- Personal review per book; reading progress and "did not finish" details per reading.

alter table public.books
  add column review text;

alter table public.readings
  -- Where you are now (open reading) or where you stopped (did not finish). Use one or the other.
  add column progress_page integer check (progress_page >= 0),
  add column progress_percent numeric(5,2) check (progress_percent between 0 and 100),
  add column progress_updated_at timestamptz,
  -- Why you stopped, for a reading that ended as "abandoned" (did not finish).
  add column stop_reason text;
