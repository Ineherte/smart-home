-- Household membership: only the owner can create invites; invited users can
-- accept one unexpired invite. Never expose service-role keys in the client.

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text,
  role text not null default 'member' check (role in ('member', 'guest')),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists household_invites_household_idx on public.household_invites(household_id);
create index if not exists household_invites_email_idx on public.household_invites(lower(invited_email));
alter table public.household_invites enable row level security;

create policy "Owners read household invites" on public.household_invites for select to authenticated using (
  exists (select 1 from public.household_members m where m.household_id = household_invites.household_id and m.user_id = auth.uid() and m.role = 'owner')
);
create policy "Owners create household invites" on public.household_invites for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.household_members m where m.household_id = household_invites.household_id and m.user_id = auth.uid() and m.role = 'owner')
);

create or replace function public.accept_household_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_invite public.household_invites;
begin
  select * into found_invite
  from public.household_invites
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now()
  for update;

  if found_invite.id is null then
    raise exception 'Invite not found or expired';
  end if;

  if found_invite.invited_email is not null and lower(found_invite.invited_email) <> lower((select email from auth.users where id = auth.uid())) then
    raise exception 'Invite belongs to another email';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (found_invite.household_id, auth.uid(), found_invite.role)
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = found_invite.id;
  return found_invite.household_id;
end;
$$;

revoke all on function public.accept_household_invite(text) from public;
grant execute on function public.accept_household_invite(text) to authenticated;
