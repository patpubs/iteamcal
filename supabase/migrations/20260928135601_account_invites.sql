-- Pre-approved sign-ins. When someone signs in for the first time with an
-- email listed here, they start with this role, approval, and crew link
-- instead of waiting as pending staff. Used to bring over accounts from the
-- old app, and later for inviting new people.

create table public.account_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and email <> ''),
  role public.app_role not null default 'staff',
  approval public.approval_status not null default 'approved',
  crew_id uuid references public.crew (id) on delete set null,
  -- Account id in the old app, for matching imported timecards and requests.
  legacy_user_id text,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_invites_email_unique unique (email)
);

-- Old-app ids let later imports (shifts, time off) find the right crew member.
alter table public.crew add column legacy_id integer unique;

alter table public.account_invites enable row level security;
create policy "admins read invites" on public.account_invites
  for select to authenticated using (public.is_admin());
create policy "admins insert invites" on public.account_invites
  for insert to authenticated with check (public.is_admin());
create policy "admins update invites" on public.account_invites
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete invites" on public.account_invites
  for delete to authenticated using (public.is_admin());
revoke all on public.account_invites from anon;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_first boolean;
  inv public.account_invites;
  link uuid;
begin
  perform pg_advisory_xact_lock(hashtext('iteamcal_bootstrap'));
  select not exists (select 1 from public.profiles) into is_first;

  select * into inv from public.account_invites
  where email = lower(btrim(new.email)) and claimed_at is null
  for update;

  -- Only take the crew link if no other account already has it.
  if inv.id is not null and inv.approval = 'approved' and inv.crew_id is not null
     and not exists (select 1 from public.profiles where crew_id = inv.crew_id) then
    link := inv.crew_id;
  end if;

  insert into public.profiles (id, email, display_name, role, approval, crew_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin'::public.app_role
         when inv.id is not null then inv.role
         else 'staff'::public.app_role end,
    case when is_first then 'approved'::public.approval_status
         when inv.id is not null then inv.approval
         else 'pending'::public.approval_status end,
    link
  );

  if inv.id is not null then
    update public.account_invites set claimed_by = new.id, claimed_at = now() where id = inv.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from authenticated, anon;
