-- A rating per reading (so re-reads show how your opinion changed), and a book description.

alter table public.readings
  add column rating numeric(2,1) check (rating between 0.5 and 5);

alter table public.books
  add column description text;

-- Keep existing ratings: copy each rated book's rating onto its most recent finished reading.
update public.readings r
   set rating = b.rating
  from public.books b
 where b.id = r.book_id
   and b.rating is not null
   and r.id = (
     select r2.id
       from public.readings r2
      where r2.book_id = b.id
        and r2.outcome = 'finished'
      order by r2.finished_at desc nulls last, r2.created_at desc
      limit 1
   );
