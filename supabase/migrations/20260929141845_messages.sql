-- Which ways each notification goes out. Everything shows in the in-app
-- inbox; push and email can each be left off. The weekly hours review is
-- email only (no weekend pushes), and admins choose for their messages.
alter table public.notifications
  add column send_push boolean not null default true,
  add column send_email boolean not null default true;

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
      where shift_date = day and start_time is not null
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
      where shift_date = day and end_time is not null
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
             or exists (select 1 from public.shifts x where x.crew_id = p.crew_id and x.shift_date between week_from and week_from + 6))
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

-- ─── Messages from admins ───────────────────────────────────────────────────
-- A shift change, a weather alert, the office closing early: an admin sends
-- a short message to chosen people, or to everyone (p_to null). It always
-- goes by push and to the inbox; email only when asked.
create function public.send_message(p_title text, p_body text, p_to uuid[] default null, p_email boolean default false)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  title text := btrim(coalesce(p_title, ''));
  body text := btrim(coalesce(p_body, ''));
  sent integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can send messages.' using errcode = '42501';
  end if;
  if title = '' then
    raise exception 'Add a title.';
  end if;
  if length(title) > 80 then
    raise exception 'Keep the title under 80 characters.';
  end if;
  if length(body) > 500 then
    raise exception 'Keep the message under 500 characters.';
  end if;
  insert into public.notifications (user_id, kind, title, body, link, send_push, send_email)
  select p.id, 'message', title, nullif(body, ''), '/more/notifications', true, coalesce(p_email, false)
  from public.profiles p
  where p.approval = 'approved'
    and p.id is distinct from auth.uid()
    and (p_to is null or p.id = any (p_to));
  get diagnostics sent = row_count;
  if sent = 0 then
    raise exception 'Pick at least one person to send to.';
  end if;
  return sent;
end;
$$;
revoke execute on function public.send_message(text, text, uuid[], boolean) from anon, public;
grant execute on function public.send_message(text, text, uuid[], boolean) to authenticated;

-- For the message screen: who has push turned on somewhere, so admins know
-- who'd only see it in the app (or by email).
create function public.push_ready_users() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct user_id from public.push_subscriptions where public.is_admin();
$$;
revoke execute on function public.push_ready_users() from anon, public;
grant execute on function public.push_ready_users() to authenticated;
