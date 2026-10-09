-- "Up next": a short, hand-ordered queue of books to read next.
-- queue_position is null for books not in the queue; 1 is the pinned "next read".

alter table public.books
  add column queue_position integer check (queue_position > 0);

create index books_user_queue_idx on public.books (user_id, queue_position)
  where queue_position is not null and deleted_at is null;

-- Saves the whole queue order in one statement: `ids` is the new order, first = next read.
-- Books of this user that are not in `ids` leave the queue. Runs with the caller's rights,
-- so RLS still limits it to the caller's own books.
create function public.reorder_queue(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.books
     set queue_position = null
   where user_id = (select auth.uid())
     and queue_position is not null
     and not (id = any(ids));

  update public.books b
     set queue_position = q.position::int
    from unnest(ids) with ordinality as q(id, position)
   where b.id = q.id
     and b.user_id = (select auth.uid());
$$;

revoke execute on function public.reorder_queue(uuid[]) from public, anon;
grant execute on function public.reorder_queue(uuid[]) to authenticated;
