-- iTeamCal initial schema.
-- Permissions are enforced here with row-level security; the app's hidden
-- buttons are never the only guard (PRD §3 "API authorization is the boundary").

create extension if not exists pgcrypto;

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.app_role as enum ('admin', 'staff');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.time_off_type as enum ('vacation', 'sick', 'personal', 'other');
create type public.request_status as enum ('pending', 'approved', 'declined');

-- ─── Workspace settings (single row) ────────────────────────────────────────
create table public.settings (
  id boolean primary key default true check (id),
  timezone text not null default 'America/Chicago',
  -- When false, staff see only that a coworker is off, not the type or reason.
  staff_see_coworker_time_off_details boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.settings default values;

-- ─── Crew roster ────────────────────────────────────────────────────────────
create table public.crew (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  job_label text,
  color text not null default '#3B6EA8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  full_time boolean not null default false,
  hide_timecards boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crew_sort_idx on public.crew (sort_order, name);

-- ─── Accounts ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role public.app_role not null default 'staff',
  approval public.approval_status not null default 'pending',
  -- One account per crew member (plan decision; PRD §14 "timecard identity").
  crew_id uuid unique references public.crew (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Scheduling ─────────────────────────────────────────────────────────────
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew (id) on delete cascade,
  shift_date date not null,
  start_time time,
  end_time time,
  notes text,
  -- Set on shifts created by "copy week" so the copy can be undone in one step.
  copy_batch_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Untimed shifts are allowed; when both times exist, same-day order applies.
  constraint shifts_time_order check (start_time is null or end_time is null or end_time > start_time)
);
create index shifts_date_idx on public.shifts (shift_date, crew_id);
create index shifts_batch_idx on public.shifts (copy_batch_id) where copy_batch_id is not null;

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Time off ───────────────────────────────────────────────────────────────
create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  crew_id uuid not null references public.crew (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type public.time_off_type not null,
  reason text,
  status public.request_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  constraint requests_date_order check (start_date <= end_date)
);
create index requests_status_idx on public.time_off_requests (status, created_at desc);
create index requests_dates_idx on public.time_off_requests (start_date, end_date);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crew (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type public.time_off_type not null,
  reason text,
  -- The request whose approval created this absence, if any. Later edits to the
  -- absence do not change the historical decision (PRD §8).
  request_id uuid unique references public.time_off_requests (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_off_date_order check (start_date <= end_date)
);
create index time_off_dates_idx on public.time_off (start_date, end_date);
create index time_off_crew_idx on public.time_off (crew_id);

-- ─── Timecards ──────────────────────────────────────────────────────────────
create table public.timecards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  start_time time not null,
  end_time time,
  lunch_start time,
  lunch_end time,
  -- Shift minus lunch, two decimals; null while the shift is still open.
  net_hours numeric(5, 2) generated always as (
    case when end_time is null then null
    else round(
      (extract(epoch from (end_time - start_time))
        - coalesce(extract(epoch from (lunch_end - lunch_start)), 0)) / 3600.0, 2)
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timecards_one_per_day unique (user_id, work_date),
  constraint timecards_end_after_start check (end_time is null or end_time > start_time),
  constraint timecards_lunch_end_needs_start check (lunch_end is null or lunch_start is not null),
  constraint timecards_lunch_order check (lunch_end is null or lunch_end > lunch_start),
  constraint timecards_lunch_after_start check (lunch_start is null or lunch_start >= start_time),
  -- A finished shift can't have an open lunch, and lunch must sit inside it.
  constraint timecards_closed_lunch check (
    end_time is null or lunch_start is null or (lunch_end is not null and lunch_end <= end_time)
  )
);
create index timecards_date_idx on public.timecards (work_date);

-- ─── Notifications and audit ────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ─── Helper functions ───────────────────────────────────────────────────────
-- Read from current account data on every request, so role and approval
-- changes apply immediately (PRD §3).
create function public.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval = 'approved'
  );
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval = 'approved' and role = 'admin'
  );
$$;

create function public.my_crew_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select crew_id from public.profiles where id = auth.uid();
$$;

create function public.timecards_hidden_for(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.hide_timecards
    from public.profiles p join public.crew c on c.id = p.crew_id
    where p.id = p_user
  ), false);
$$;

create function public.local_today() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone (select timezone from public.settings limit 1))::date;
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger crew_touch before update on public.crew
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger shifts_touch before update on public.shifts
  for each row execute function public.touch_updated_at();
create trigger holidays_touch before update on public.holidays
  for each row execute function public.touch_updated_at();
create trigger time_off_touch before update on public.time_off
  for each row execute function public.touch_updated_at();
create trigger timecards_touch before update on public.timecards
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ─── Account rules ──────────────────────────────────────────────────────────
-- First account becomes the approved admin; everyone after starts as pending staff.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_first boolean;
begin
  perform pg_advisory_xact_lock(hashtext('iteamcal_bootstrap'));
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, display_name, role, approval)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin'::public.app_role else 'staff'::public.app_role end,
    case when is_first then 'approved'::public.approval_status else 'pending'::public.approval_status end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The last approved admin can't be demoted, rejected, or deleted (PRD §3).
create function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.approval = 'approved'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.approval <> 'approved') then
    perform pg_advisory_xact_lock(hashtext('iteamcal_last_admin'));
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and approval = 'approved' and id <> old.id
    ) then
      raise exception 'At least one approved admin is required.'
        using errcode = 'P0001', hint = 'Promote another admin first.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_last_admin before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

-- Only approved accounts can be linked to crew; archiving crew clears links.
create function public.guard_profile_link() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Checked when a link is made; revoking access later keeps the link so
  -- re-approval restores it.
  if new.crew_id is not null and new.approval <> 'approved'
     and (tg_op = 'INSERT' or new.crew_id is distinct from old.crew_id) then
    raise exception 'Only approved accounts can be linked to a crew member.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_link_guard before insert or update of crew_id, approval on public.profiles
  for each row execute function public.guard_profile_link();

create function public.unlink_archived_crew() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    update public.profiles set crew_id = null where crew_id = new.id;
  end if;
  return new;
end;
$$;

create trigger crew_unlink_on_archive after update of archived_at on public.crew
  for each row execute function public.unlink_archived_crew();

-- ─── Timecard rules ─────────────────────────────────────────────────────────
-- Enforced in the database, not only by hiding navigation (PRD §10, §14).
create function public.guard_timecard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and approval = 'approved') then
    raise exception 'Timecards can only belong to approved accounts.' using errcode = 'P0001';
  end if;
  if public.timecards_hidden_for(new.user_id) then
    raise exception 'This person is set to not need timecards.' using errcode = 'P0001';
  end if;
  if new.work_date > public.local_today() then
    raise exception 'Timecards can''t be added for future dates.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger timecards_guard before insert or update on public.timecards
  for each row execute function public.guard_timecard();

-- A manager changing someone else's card notifies them and leaves an audit entry.
create function public.log_timecard_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target uuid := coalesce(new.user_id, old.user_id);
  day date := coalesce(new.work_date, old.work_date);
  verb text;
begin
  if auth.uid() is null or auth.uid() = target then
    return coalesce(new, old);
  end if;
  verb := case tg_op when 'INSERT' then 'added' when 'UPDATE' then 'edited' else 'deleted' end;
  insert into public.audit_log (actor_id, action, table_name, record_id, before, after)
  values (
    auth.uid(), 'timecard_' || lower(tg_op), 'timecards', coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  if tg_op <> 'INSERT' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (
      target, 'timecard_changed',
      'Your timecard was ' || verb,
      'A manager ' || verb || ' your timecard for ' || to_char(day, 'Dy Mon FMDD') || '.',
      '/timecards?week=' || to_char(day, 'YYYY-MM-DD')
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger timecards_log after insert or update or delete on public.timecards
  for each row execute function public.log_timecard_change();

-- ─── Time-off request rules ─────────────────────────────────────────────────
create function public.guard_request_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'pending';
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := null;
  if exists (select 1 from public.crew where id = new.crew_id and archived_at is not null) then
    raise exception 'This crew member is archived.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger requests_insert_guard before insert on public.time_off_requests
  for each row execute function public.guard_request_insert();

-- Approve or decline once. Approval creates exactly one absence (PRD §8).
create function public.decide_time_off_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
) returns public.time_off_requests
language plpgsql security definer set search_path = '' as $$
declare
  req public.time_off_requests;
begin
  if not public.is_admin() then
    raise exception 'Only admins can decide requests.' using errcode = '42501';
  end if;

  select * into req from public.time_off_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.' using errcode = 'P0002';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request was already %.', req.status using errcode = 'P0001';
  end if;

  update public.time_off_requests
  set status = case when p_approve then 'approved'::public.request_status else 'declined'::public.request_status end,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = nullif(btrim(p_note), '')
  where id = p_request_id
  returning * into req;

  if p_approve then
    insert into public.time_off (crew_id, start_date, end_date, type, reason, request_id, created_by)
    values (req.crew_id, req.start_date, req.end_date, req.type, req.reason, req.id, auth.uid());
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    req.requester_id,
    'request_decided',
    'Time off ' || req.status::text,
    'Your ' || req.type::text || ' request for ' || to_char(req.start_date, 'Mon FMDD')
      || case when req.end_date <> req.start_date then '–' || to_char(req.end_date, 'Mon FMDD') else '' end
      || ' was ' || req.status::text || '.'
      || coalesce(' Note: ' || req.decision_note, ''),
    '/time-off'
  );

  return req;
end;
$$;

-- Time off in a date range, with type and reason hidden from staff for
-- coworkers unless the workspace allows it (plan decision on PRD §7 privacy).
create function public.time_off_in_range(p_from date, p_to date)
returns table (
  id uuid,
  crew_id uuid,
  start_date date,
  end_date date,
  type public.time_off_type,
  reason text
)
language sql stable security definer set search_path = '' as $$
  select
    t.id, t.crew_id, t.start_date, t.end_date,
    case when public.is_admin() or t.crew_id = public.my_crew_id()
              or (select staff_see_coworker_time_off_details from public.settings limit 1)
         then t.type end,
    case when public.is_admin() or t.crew_id = public.my_crew_id()
         then t.reason end
  from public.time_off t
  where public.is_approved()
    and t.start_date <= p_to
    and t.end_date >= p_from;
$$;

-- ─── Row-level security ─────────────────────────────────────────────────────
alter table public.settings enable row level security;
alter table public.crew enable row level security;
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.holidays enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.time_off enable row level security;
alter table public.timecards enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- settings
create policy "approved read settings" on public.settings
  for select to authenticated using (public.is_approved());
create policy "admins update settings" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- crew
create policy "approved read crew" on public.crew
  for select to authenticated using (public.is_approved());
create policy "admins insert crew" on public.crew
  for insert to authenticated with check (public.is_admin());
create policy "admins update crew" on public.crew
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete crew" on public.crew
  for delete to authenticated using (public.is_admin());

-- profiles: everyone can see their own (so pending/rejected screens work);
-- admins see and manage all.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "admins read profiles" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete profiles" on public.profiles
  for delete to authenticated using (public.is_admin());

-- shifts
create policy "approved read shifts" on public.shifts
  for select to authenticated using (public.is_approved());
create policy "admins insert shifts" on public.shifts
  for insert to authenticated with check (public.is_admin());
create policy "admins update shifts" on public.shifts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete shifts" on public.shifts
  for delete to authenticated using (public.is_admin());

-- holidays
create policy "approved read holidays" on public.holidays
  for select to authenticated using (public.is_approved());
create policy "admins insert holidays" on public.holidays
  for insert to authenticated with check (public.is_admin());
create policy "admins update holidays" on public.holidays
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete holidays" on public.holidays
  for delete to authenticated using (public.is_admin());

-- time_off: staff read only their own rows directly; the shared schedule uses
-- time_off_in_range().
create policy "read own or all time off" on public.time_off
  for select to authenticated
  using (public.is_admin() or (public.is_approved() and crew_id = public.my_crew_id()));
create policy "admins insert time off" on public.time_off
  for insert to authenticated with check (public.is_admin());
create policy "admins update time off" on public.time_off
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete time off" on public.time_off
  for delete to authenticated using (public.is_admin());

-- time_off_requests: linked users request for themselves; cancel while pending.
-- Decisions go through decide_time_off_request().
create policy "read own or all requests" on public.time_off_requests
  for select to authenticated
  using (public.is_admin() or (public.is_approved() and requester_id = auth.uid()));
create policy "request own time off" on public.time_off_requests
  for insert to authenticated
  with check (
    public.is_approved()
    and requester_id = auth.uid()
    and crew_id = public.my_crew_id()
  );
create policy "cancel own pending request" on public.time_off_requests
  for delete to authenticated
  using (requester_id = auth.uid() and status = 'pending' and public.is_approved());

-- timecards
create policy "read own or all timecards" on public.timecards
  for select to authenticated
  using (public.is_admin() or (public.is_approved() and user_id = auth.uid()));
create policy "write own or any timecard" on public.timecards
  for insert to authenticated
  with check (public.is_admin() or (public.is_approved() and user_id = auth.uid()));
create policy "update own or any timecard" on public.timecards
  for update to authenticated
  using (public.is_admin() or (public.is_approved() and user_id = auth.uid()))
  with check (public.is_admin() or (public.is_approved() and user_id = auth.uid()));
create policy "delete own or any timecard" on public.timecards
  for delete to authenticated
  using (public.is_admin() or (public.is_approved() and user_id = auth.uid()));

-- notifications: each person reads and marks read only their own.
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_log: admins read; rows are written only by triggers.
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

-- ─── Privileges ─────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
grant execute on function
  public.is_approved(), public.is_admin(), public.my_crew_id(), public.local_today(),
  public.decide_time_off_request(uuid, boolean, text),
  public.time_off_in_range(date, date)
  to authenticated;
-- Staff may only flip read_at on their own notifications.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
-- Requests are never edited directly (cancel and resubmit instead).
revoke update on public.time_off_requests from authenticated;

-- Live updates for the notification bell and schedule refresh.
alter publication supabase_realtime add table public.notifications, public.shifts, public.time_off, public.holidays;
