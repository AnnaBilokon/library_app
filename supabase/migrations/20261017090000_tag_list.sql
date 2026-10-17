-- Your tag list: the mood and theme tags ("затишна історія", "сильні жінки") that tag suggestions
-- choose from, so tags stay consistent and easy to filter. Personal, like tags themselves.

alter table public.user_settings add column tag_list text[] not null default '{}';
