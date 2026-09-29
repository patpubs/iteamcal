-- More notifications:
-- 1. Admins hear about each new time off request (push + email).
-- 2. Supervisors: any account an admin turns "Timecard change alerts" on for
--    hears when staff type in or change their own start or end time. The
--    Clock in/out buttons don't count.

-- ─── New time off requests ──────────────────────────────────────────────────
create function public.notify_new_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce((select name from public.crew where id = new.crew_id), 'Someone');
  dates text := to_char(new.start_date, 'Dy Mon FMDD')
    || case when new.end_date <> new.start_date then ' – ' || to_char(new.end_date, 'Dy Mon FMDD') else '' end;
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'request_new',
         'Time off request from ' || who,
         initcap(new.type::text) || ', ' || dates || '.' || coalesce(' "' || nullif(btrim(new.reason), '') || '"', ''),
         '/time-off?tab=requests'
  from public.profiles p
  where p.role = 'admin' and p.approval = 'approved' and p.id <> new.requester_id;
  return new;
end;
$$;
revoke execute on function public.notify_new_request() from anon, authenticated, public;

create trigger requests_notify_admins after insert on public.time_off_requests
  for each row execute function public.notify_new_request();

-- ─── Timecard change alerts ─────────────────────────────────────────────────
alter table public.profiles add column timecard_alerts boolean not null default false;

create or replace function public.punch(p_action text) returns public.timecards
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
  -- Clock buttons aren't manual edits, so supervisors aren't alerted.
  perform set_config('iteamcal.punch', 'on', true);

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

create function public.notify_timecard_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text;
  changes text[];
  sup record;
begin
  -- Only people editing their own card by hand.
  if auth.uid() is null or auth.uid() <> new.user_id
     or coalesce(current_setting('iteamcal.punch', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.start_time is not distinct from old.start_time
     and new.end_time is not distinct from old.end_time then
    return new;
  end if;
  select coalesce(c.name, p.display_name, p.email, 'Someone') into who
  from public.profiles p left join public.crew c on c.id = p.crew_id
  where p.id = new.user_id;

  for sup in
    select id from public.profiles
    where timecard_alerts and approval = 'approved' and id <> new.user_id
  loop
    changes := array[]::text[];
    if tg_op = 'INSERT' then
      changes := changes || ('start ' || public.format_time_for(sup.id, new.start_time));
      if new.end_time is not null then
        changes := changes || ('end ' || public.format_time_for(sup.id, new.end_time));
      end if;
    else
      if new.start_time is distinct from old.start_time then
        changes := changes || ('start ' || public.format_time_for(sup.id, old.start_time) || ' → '
                               || public.format_time_for(sup.id, new.start_time));
      end if;
      if new.end_time is distinct from old.end_time then
        changes := changes || ('end ' || coalesce(public.format_time_for(sup.id, old.end_time), 'blank') || ' → '
                               || coalesce(public.format_time_for(sup.id, new.end_time), 'blank'));
      end if;
    end if;
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      sup.id, 'timecard_edited_by_owner',
      who || case when tg_op = 'INSERT' then ' added a timecard' else ' changed their timecard' end,
      to_char(new.work_date, 'Dy Mon FMDD') || ': ' || array_to_string(changes, ', ') || '.',
      '/timecards?tab=crew&week=' || to_char(new.work_date, 'YYYY-MM-DD')
    );
  end loop;
  return new;
end;
$$;
revoke execute on function public.notify_timecard_edit() from anon, authenticated, public;

create trigger timecards_alert_supervisors after insert or update on public.timecards
  for each row execute function public.notify_timecard_edit();
