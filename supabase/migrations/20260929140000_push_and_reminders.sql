-- Push notifications on phones and computers, plus automatic reminders:
-- "Did you forget to clock in?", "...clock out?", and a weekly hours review.
-- Reminders are ordinary notifications, so they show in the app's inbox and
-- go out by email and push like every other notification.

-- ─── Push keys ──────────────────────────────────────────────────────────────
-- Web push signs each message with a key pair (VAPID). The notify-email Edge
-- Function creates the pair the first time it's needed, so the private key
-- never leaves the server. Nobody signed in can read this table.
create table public.push_keys (
  id boolean primary key default true check (id),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;

-- The public half, which a browser needs to sign up for push.
create function public.push_public_key() returns text
language sql stable security definer set search_path = '' as $$
  select public_key from public.push_keys where public.is_approved();
$$;
revoke execute on function public.push_public_key() from anon, public;
grant execute on function public.push_public_key() to authenticated;

-- ─── Devices signed up for push ─────────────────────────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "own devices: read" on public.push_subscriptions for select
  using (user_id = auth.uid());
create policy "own devices: remove" on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- Saves this device for the signed-in person. A device that was signed in as
-- someone else moves to the new account, so pushes follow whoever uses it.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved() then
    raise exception 'Only approved accounts can turn on notifications.';
  end if;
  if p_endpoint !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'That push sign-up is missing details.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from anon, public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ─── Reminder settings ──────────────────────────────────────────────────────
alter table public.settings
  -- Off until an admin turns it on (More → Settings), so nobody gets reminders
  -- while the crew still clocks in somewhere else.
  add column reminders_enabled boolean not null default false,
  -- How late before "Did you forget to clock in/out?" goes out.
  add column reminder_minutes integer not null default 15 check (reminder_minutes between 5 and 120),
  -- Weekly hours review: day of the week (0 = Sunday) and local time.
  add column weekly_review_day integer not null default 0 check (weekly_review_day between 0 and 6),
  add column weekly_review_time time not null default '18:00';

-- Which reminders already went out, so each one is sent once.
create table public.reminders_sent (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.reminders_sent enable row level security;
revoke all on public.reminders_sent from anon, authenticated;

-- A time in the person's chosen style ("9:00 AM", "9a", "09:00").
create function public.format_time_for(p_user uuid, p_time time) returns text
language sql stable security definer set search_path = '' as $$
  select case coalesce((select time_format from public.user_preferences where user_id = p_user), 'full')
    when '24h' then to_char(p_time, 'HH24:MI')
    when 'short' then to_char(p_time, 'FMHH12')
      || case when extract(minute from p_time) = 0 then '' else to_char(p_time, ':MI') end
      || case when p_time < '12:00' then 'a' else 'p' end
    else to_char(p_time, 'FMHH12:MI AM')
  end;
$$;
revoke execute on function public.format_time_for(uuid, time) from anon, authenticated, public;

-- Runs every minute. p_now is only passed by tests.
create function public.send_reminders(p_now timestamptz default now()) returns integer
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
        insert into public.notifications (user_id, kind, title, body, link)
        values (r.user_id, 'weekly_review', 'Review your hours for this week',
                'Your timecards add up to ' || to_char(r.hours, 'FM9990.00') || ' hours for '
                  || to_char(week_from, 'FMMon FMDD') || ' – ' || to_char(week_from + 6, 'FMMon FMDD')
                  || '. Take a look and fix anything that’s off.'
                  || case when r.open_days = 1 then ' One day is missing a clock-out.'
                          when r.open_days > 1 then ' ' || r.open_days || ' days are missing a clock-out.'
                          else '' end,
                '/timecards?week=' || week_from);
        sent := sent + 1;
      end if;
    end loop;
  end if;

  return sent;
end;
$$;
revoke execute on function public.send_reminders(timestamptz) from anon, authenticated, public;

-- Every minute. Local test databases don't ship pg_cron; tests call
-- send_reminders directly instead.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('send-reminders', '* * * * *', 'select public.send_reminders()');
exception when others then
  raise notice 'pg_cron not available: %', sqlerrm;
end $$;
