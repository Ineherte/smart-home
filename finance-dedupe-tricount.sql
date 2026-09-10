delete from public.shared_expenses as duplicate
where duplicate.source = 'tricount'
  and duplicate.source_reference is not null
  and duplicate.id not in (
    select min(id)
    from public.shared_expenses
    where source = 'tricount'
      and source_reference is not null
    group by source_reference
  );

create unique index if not exists shared_expenses_tricount_reference_idx
  on public.shared_expenses (source_reference);
