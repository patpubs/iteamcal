-- Reminders follow part-day time off: someone off until noon is due at noon,
-- and someone leaving at noon is reminded to clock out then.
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

  -- Clock in: the day's first shift started a while ago (or the part-day
  -- time off covering its start ended) and there's no timecard yet. Stops
  -- trying a few hours in, so a late run doesn't nag.
  for r in
    select * from (
      select p.id as user_id, s.id as shift_id, s.end_time,
             case when o.start_time is not null and o.start_time <= s.start_time and o.end_time > s.start_time
                  then o.end_time else s.start_time end as due
      from (
        select distinct on (crew_id) crew_id, id, start_time, end_time
        from public.shifts
        where shift_date = day and start_time is not null and public.week_published(day)
        order by crew_id, start_time
      ) s
      join public.crew c on c.id = s.crew_id and c.archived_at is null
      join public.profiles p on p.crew_id = s.crew_id and p.approval = 'approved'
      left join lateral (
        select x.start_time, x.end_time, x.start_time is null as whole_day from public.time_off x
        where x.crew_id = s.crew_id and day between x.start_date and x.end_date
        order by x.start_time nulls first
        limit 1
      ) o on true
      where not coalesce(o.whole_day, false)
        and not public.timecards_hidden_for(p.id)
        and not exists (select 1 from public.timecards t where t.user_id = p.id and t.work_date = day)
    ) due
    where (due.end_time is null or due.due < due.end_time)
      and local_now >= day + due.due + grace
      and local_now < day + due.due + interval '4 hours'
  loop
    insert into public.reminders_sent (key) values ('clock-in:' || r.shift_id) on conflict do nothing;
    if found then
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.user_id, 'clock_in_reminder', 'Did you forget to clock in?',
              'Your shift started at ' || public.format_time_for(r.user_id, r.due)
                || '. Clock in now, or add the time on your timecard.',
              '/timecards');
      sent := sent + 1;
    end if;
  end loop;

  -- Clock out: the day's last shift ended a while ago (or part-day time off
  -- starts before its end) and today's card is still open.
  for r in
    select * from (
      select p.id as user_id, s.id as shift_id,
             case when o.start_time is not null and o.start_time < s.end_time and o.end_time >= s.end_time
                  then o.start_time else s.end_time end as due
      from (
        select distinct on (crew_id) crew_id, id, end_time
        from public.shifts
        where shift_date = day and end_time is not null and public.week_published(day)
        order by crew_id, end_time desc
      ) s
      join public.profiles p on p.crew_id = s.crew_id and p.approval = 'approved'
      join public.timecards t on t.user_id = p.id and t.work_date = day and t.end_time is null
      left join lateral (
        select x.start_time, x.end_time from public.time_off x
        where x.crew_id = s.crew_id and day between x.start_date and x.end_date and x.start_time is not null
        order by x.end_time desc
        limit 1
      ) o on true
      where not public.timecards_hidden_for(p.id)
    ) due
    where local_now >= day + due.due + grace
      and local_now < day + due.due + interval '6 hours'
  loop
    insert into public.reminders_sent (key) values ('clock-out:' || r.shift_id) on conflict do nothing;
    if found then
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.user_id, 'clock_out_reminder', 'Did you forget to clock out?',
              'Your shift ended at ' || public.format_time_for(r.user_id, r.due)
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
revoke execute on function public.send_reminders(timestamptz) from anon, authenticated, public;
