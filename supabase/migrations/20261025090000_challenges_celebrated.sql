-- The reading-challenge goals you've already been congratulated on, per year ({"2026": 30}), so
-- the "challenge complete" dialog shows once (and again if you raise the goal and reach it).

alter table public.user_settings add column challenges_celebrated jsonb not null default '{}';
