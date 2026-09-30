with ranked_duplicates as (
  select id,
         row_number() over (
           partition by source_reference
           order by created_at asc nulls last, id
         ) as row_number
  from public.shared_expenses
  where source = 'tricount'
    and source_reference is not null
)
delete from public.shared_expenses as duplicate
using ranked_duplicates
where duplicate.id = ranked_duplicates.id
  and ranked_duplicates.row_number > 1;

create unique index if not exists shared_expenses_tricount_reference_idx
  on public.shared_expenses (source_reference);
