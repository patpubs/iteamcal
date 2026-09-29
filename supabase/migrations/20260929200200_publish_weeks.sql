-- Draft and publish, one Monday–Sunday week at a time.
-- Admins build a week in draft; staff can't see its shifts until an admin
-- publishes it, and publishing tells everyone scheduled that week. Changes to
-- a week that's already out show right away, and the admin sends an update
-- to the people whose shifts changed when ready.

create function public.week_of(p_day date) returns date
language sql immutable set search_path = '' as $$
  select p_day - (extract(isodow from p_day)::integer - 1);
$$;

create table public.schedule_weeks (
  week_start date primary key check (extract(isodow from week_start) = 1),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id) on delete set null,
  -- Crew whose shifts changed since the last publish or update.
  changed_crew uuid[] not null default '{}'
);

alter table public.schedule_weeks enable row level security;
create policy "approved read schedule weeks" on public.schedule_weeks
  for select to authenticated using (public.is_approved());
-- Writes go through publish_week and unpublish_week.

create function public.week_published(p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.schedule_weeks where week_start = public.week_of(p_day));
$$;
revoke execute on function public.week_published(date) from anon, public;

-- Everything already on the schedule was visible in the old app, so those
-- weeks start out published. New weeks start as drafts.
insert into public.schedule_weeks (week_start)
select distinct public.week_of(shift_date) from public.shifts;

drop policy "approved read shifts" on public.shifts;
create policy "approved read shifts" on public.shifts
  for select to authenticated
  using (public.is_admin() or (public.is_approved() and public.week_published(shift_date)));

-- Remember who to tell when a published week changes.
create function public.track_published_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.crew_id = old.crew_id and new.shift_date = old.shift_date
     and new.start_time is not distinct from old.start_time and new.end_time is not distinct from old.end_time
     and new.notes is not distinct from old.notes then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    update public.schedule_weeks
    set changed_crew = array_append(array_remove(changed_crew, old.crew_id), old.crew_id)
    where week_start = public.week_of(old.shift_date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.schedule_weeks
    set changed_crew = array_append(array_remove(changed_crew, new.crew_id), new.crew_id)
    where week_start = public.week_of(new.shift_date);
  end if;
  return null;
end;
$$;
revoke execute on function public.track_published_changes() from anon, authenticated, public;

create trigger shifts_track_published_changes after insert or update or delete on public.shifts
  for each row execute function public.track_published_changes();

-- One person's shifts for a week, in their time format, for a notification.
create function public.week_summary_for(p_user uuid, p_crew uuid, p_week date) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    string_agg(
      to_char(s.shift_date, 'Dy FMMon FMDD')
        || case when s.start_time is null then ''
                else ' ' || public.format_time_for(p_user, s.start_time)
                     || coalesce(' – ' || public.format_time_for(p_user, s.end_time), '') end,
      ', ' order by s.shift_date, s.start_time nulls last),
    'You aren’t scheduled this week.')
  from public.shifts s
  where s.crew_id = p_crew and s.shift_date between p_week and p_week + 6;
$$;
revoke execute on function public.week_summary_for(uuid, uuid, date) from anon, authenticated, public;

-- First publish: makes the week visible and tells everyone scheduled in it.
-- Already published: tells the people whose shifts changed since (p_notify
-- false clears the list without telling anyone). Returns how many were told.
create function public.publish_week(p_week date, p_notify boolean default true) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  week date := public.week_of(p_week);
  existing public.schedule_weeks;
  first_time boolean;
  sent integer := 0;
  label text := to_char(week, 'FMMon FMDD') || ' – ' || to_char(week + 6, 'FMMon FMDD');
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish the schedule.' using errcode = '42501';
  end if;
  select * into existing from public.schedule_weeks where week_start = week for update;
  first_time := existing.week_start is null;

  if first_time then
    insert into public.schedule_weeks (week_start, published_by) values (week, auth.uid());
  else
    update public.schedule_weeks set changed_crew = '{}' where week_start = week;
  end if;

  if p_notify then
    insert into public.notifications (user_id, kind, title, body, link)
    select p.id,
           case when first_time then 'schedule_published' else 'schedule_changed' end,
           case when first_time then 'Schedule posted for ' else 'Your schedule changed for ' end || label,
           public.week_summary_for(p.id, p.crew_id, week),
           '/?view=week&date=' || to_char(week, 'YYYY-MM-DD')
    from public.profiles p
    join public.crew c on c.id = p.crew_id and c.archived_at is null
    where p.approval = 'approved'
      and p.id <> auth.uid()
      and case when first_time
               then exists (select 1 from public.shifts s
                            where s.crew_id = p.crew_id and s.shift_date between week and week + 6)
               else p.crew_id = any(existing.changed_crew) end;
    get diagnostics sent = row_count;
  end if;
  return sent;
end;
$$;
revoke execute on function public.publish_week(date, boolean) from anon, public;

-- Back to draft (hides the week from staff again). Tells no one.
create function public.unpublish_week(p_week date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the schedule.' using errcode = '42501';
  end if;
  delete from public.schedule_weeks where week_start = public.week_of(p_week);
end;
$$;
revoke execute on function public.unpublish_week(date) from anon, public;

-- Admins: who publishing or updating a week would notify.
create function public.week_recipients(p_week date) returns table (crew_id uuid, has_account boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  week date := public.week_of(p_week);
  w public.schedule_weeks;
begin
  if not public.is_admin() then
    raise exception 'Only admins can see this.' using errcode = '42501';
  end if;
  select * into w from public.schedule_weeks where week_start = week;
  return query
  select c.id,
         exists (select 1 from public.profiles p
                 where p.crew_id = c.id and p.approval = 'approved' and p.id <> auth.uid())
  from public.crew c
  where c.archived_at is null
    and case when w.week_start is null
             then exists (select 1 from public.shifts s where s.crew_id = c.id and s.shift_date between week and week + 6)
             else c.id = any(w.changed_crew) end;
end;
$$;
revoke execute on function public.week_recipients(date) from anon, public;

alter publication supabase_realtime add table public.schedule_weeks;

-- Reminders only count shifts in published weeks.
create or replace function public.send_reminders(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.settings;
  local_now timestamp;
  day date;
  grace interval;
  week_from date;
  sent integer := 0;
  r record;
begin
  select * into cfg from public.settings limit 1;
  if not cfg.reminders_enabled then
    return 0;
  end if;
  local_now := p_now at time zone cfg.timezone;
  day := local_now::date;
  grace := make_interval(mins => cfg.reminder_minutes);

  -- Clock in: the day's first shift started a while ago and there's no
  -- timecard yet. Stops trying a few hours in, so a late run doesn't nag.
  for r in
    select p.id as user_id, s.id as shift_id, s.start_time
    from (
      select distinct on (crew_id) crew_id, id, start_time
      from public.shifts
      where shift_date = day and start_time is not null and public.week_published(day)
      order by crew_id, start_time
    ) s
    join public.crew c on c.id = s.crew_id and c.archived_at is null
    join public.profiles p on p.crew_id = s.crew_id and p.approval = 'approved'
    where local_now >= day + s.start_time + grace
      and local_now < day + s.start_time + interval '4 hours'
      and not public.timecards_hidden_for(p.id)
      and not exists (select 1 from public.timecards t where t.user_id = p.id and t.work_date = day)
      and not exists (select 1 from public.time_off o
                      where o.crew_id = s.crew_id and day between o.start_date and o.end_date)
  loop
    insert into public.reminders_sent (key) values ('clock-in:' || r.shift_id) on conflict do nothing;
    if found then
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.user_id, 'clock_in_reminder', 'Did you forget to clock in?',
              'Your shift started at ' || public.format_time_for(r.user_id, r.start_time)
                || '. Clock in now, or add the time on your timecard.',
              '/timecards');
      sent := sent + 1;
    end if;
  end loop;

  -- Clock out: the day's last shift ended a while ago and today's card is
  -- still open.
  for r in
    select p.id as user_id, s.id as shift_id, s.end_time
    from (
      select distinct on (crew_id) crew_id, id, end_time
      from public.shifts
      where shift_date = day and end_time is not null and public.week_published(day)
      order by crew_id, end_time desc
    ) s
    join public.profiles p on p.crew_id = s.crew_id and p.approval = 'approved'
    join public.timecards t on t.user_id = p.id and t.work_date = day and t.end_time is null
    where local_now >= day + s.end_time + grace
      and local_now < day + s.end_time + interval '6 hours'
      and not public.timecards_hidden_for(p.id)
  loop
    insert into public.reminders_sent (key) values ('clock-out:' || r.shift_id) on conflict do nothing;
    if found then
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.user_id, 'clock_out_reminder', 'Did you forget to clock out?',
              'Your shift ended at ' || public.format_time_for(r.user_id, r.end_time)
                || '. Clock out now, or add the time on your timecard.',
              '/timecards');
      sent := sent + 1;
    end if;
  end loop;

  -- Weekly review of hours for the Monday–Sunday week, for everyone who
  -- worked or was scheduled that week.
  if extract(dow from day) = cfg.weekly_review_day and local_now::time >= cfg.weekly_review_time then
    week_from := day - (extract(isodow from day)::integer - 1);
    for r in
      select p.id as user_id,
             coalesce(sum(t.net_hours), 0) as hours,
             count(t.id) filter (where t.end_time is null) as open_days
      from public.profiles p
      join public.crew c on c.id = p.crew_id and c.archived_at is null
      left join public.timecards t on t.user_id = p.id and t.work_date between week_from and week_from + 6
      where p.approval = 'approved'
        and not public.timecards_hidden_for(p.id)
        and (exists (select 1 from public.timecards x where x.user_id = p.id and x.work_date between week_from and week_from + 6)
             or (public.week_published(week_from)
                 and exists (select 1 from public.shifts x where x.crew_id = p.crew_id and x.shift_date between week_from and week_from + 6)))
      group by p.id
    loop
      insert into public.reminders_sent (key) values ('weekly:' || r.user_id || ':' || week_from) on conflict do nothing;
      if found then
        -- Email only: no pushes to people's phones on the weekend.
        insert into public.notifications (user_id, kind, title, body, link, send_push)
        values (r.user_id, 'weekly_review', 'Review your hours for this week',
                'Your timecards add up to ' || to_char(r.hours, 'FM9990.00') || ' hours for '
                  || to_char(week_from, 'FMMon FMDD') || ' – ' || to_char(week_from + 6, 'FMMon FMDD')
                  || '. Take a look and fix anything that’s off.'
                  || case when r.open_days = 1 then ' One day is missing a clock-out.'
                          when r.open_days > 1 then ' ' || r.open_days || ' days are missing a clock-out.'
                          else '' end,
                '/timecards?week=' || week_from, false);
        sent := sent + 1;
      end if;
    end loop;
  end if;

  return sent;
end;
$$;
