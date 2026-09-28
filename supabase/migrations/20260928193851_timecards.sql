-- Phase 5: punch clock, live timecards, and old timecards waiting for their owner.

-- ─── Punch clock ────────────────────────────────────────────────────────────
-- One tap records the team's local time to the minute on today's card, so a
-- phone with the wrong clock can't punch a different time (PRD §9).
create function public.punch(p_action text) returns public.timecards
language plpgsql security invoker set search_path = '' as $$
declare
  tz text := (select timezone from public.settings limit 1);
  day date := public.local_today();
  at_time time := date_trunc('minute', now() at time zone tz)::time;
  card public.timecards;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  select * into card from public.timecards where user_id = auth.uid() and work_date = day for update;

  if p_action = 'clock_in' then
    if card.id is not null then
      raise exception 'You already have a timecard for today. Edit it instead.' using errcode = 'P0001';
    end if;
    insert into public.timecards (user_id, work_date, start_time)
    values (auth.uid(), day, at_time)
    returning * into card;
    return card;
  end if;

  if card.id is null then
    raise exception 'You haven''t clocked in today.' using errcode = 'P0001';
  end if;
  if card.end_time is not null then
    raise exception 'You''ve already clocked out today.' using errcode = 'P0001';
  end if;

  if p_action = 'lunch_start' then
    if card.lunch_start is not null then
      raise exception 'Lunch was already started today.' using errcode = 'P0001';
    end if;
    update public.timecards set lunch_start = greatest(at_time, card.start_time)
    where id = card.id returning * into card;
  elsif p_action = 'lunch_end' then
    if card.lunch_start is null or card.lunch_end is not null then
      raise exception 'You aren''t on lunch.' using errcode = 'P0001';
    end if;
    if at_time <= card.lunch_start then
      raise exception 'Lunch has to last at least a minute.' using errcode = 'P0001';
    end if;
    update public.timecards set lunch_end = at_time where id = card.id returning * into card;
  elsif p_action = 'clock_out' then
    if card.lunch_start is not null and card.lunch_end is null then
      raise exception 'End your lunch before clocking out.' using errcode = 'P0001';
    end if;
    if at_time <= card.start_time or at_time < coalesce(card.lunch_end, card.start_time) then
      raise exception 'Wait at least a minute after clocking in.' using errcode = 'P0001';
    end if;
    update public.timecards set end_time = at_time where id = card.id returning * into card;
  else
    raise exception 'Unknown punch.' using errcode = 'P0001';
  end if;
  return card;
end;
$$;

revoke execute on function public.punch(text) from anon, public;
grant execute on function public.punch(text) to authenticated;

alter publication supabase_realtime add table public.timecards;

-- ─── Old timecards ──────────────────────────────────────────────────────────
-- Cards from the old app, keyed by the old account id. They move onto the
-- person's account the first time they sign in (see handle_new_user). Nobody
-- reads this table through the API.
create table public.legacy_timecards (
  legacy_user_id text not null,
  work_date date not null,
  start_time time not null,
  end_time time,
  lunch_start time,
  lunch_end time,
  primary key (legacy_user_id, work_date)
);
alter table public.legacy_timecards enable row level security;
revoke all on public.legacy_timecards from anon, authenticated;

create function public.claim_legacy_timecards(p_user uuid, p_legacy_id text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  moved integer := 0;
  l public.legacy_timecards;
begin
  -- People set to not need timecards keep theirs here untouched.
  if p_legacy_id is null or public.timecards_hidden_for(p_user) then
    return 0;
  end if;
  -- One card at a time, so a card that breaks a rule stays here without
  -- holding back the rest.
  for l in select * from public.legacy_timecards where legacy_user_id = p_legacy_id loop
    begin
      insert into public.timecards (user_id, work_date, start_time, end_time, lunch_start, lunch_end)
      values (p_user, l.work_date, l.start_time, l.end_time, l.lunch_start, l.lunch_end);
      delete from public.legacy_timecards where legacy_user_id = l.legacy_user_id and work_date = l.work_date;
      moved := moved + 1;
    exception when others then
      null;
    end;
  end loop;
  return moved;
end;
$$;

revoke execute on function public.claim_legacy_timecards(uuid, text) from anon, authenticated, public;

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
    if inv.approval = 'approved' and inv.legacy_user_id is not null then
      -- Old cards must never block signing in; any that fail stay staged.
      begin
        perform public.claim_legacy_timecards(new.id, inv.legacy_user_id);
      exception when others then
        null;
      end;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from authenticated, anon;
