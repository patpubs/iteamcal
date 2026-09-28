-- Schedule tools (PRD §5): copy a shift onto other days, copy a week, move a
-- shift. Each runs with the caller's rights, so row security still applies;
-- the admin check gives staff a clear error instead of a silent no-op.

create function public.require_admin() returns void
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the schedule.' using errcode = '42501';
  end if;
end;
$$;

-- Copies one shift onto each date given. Dates where that person has time off
-- are skipped, as is the shift's own date. Returns how many copies were made.
create function public.duplicate_shift(p_shift_id uuid, p_dates date[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  src public.shifts;
  made integer;
begin
  perform public.require_admin();
  select * into src from public.shifts where id = p_shift_id;
  if src.id is null then
    raise exception 'That shift no longer exists.' using errcode = 'P0002';
  end if;

  insert into public.shifts (crew_id, shift_date, start_time, end_time, notes, created_by)
  select src.crew_id, d, src.start_time, src.end_time, src.notes, auth.uid()
  from (select distinct unnest(p_dates) as d) dates
  where d <> src.shift_date
    and not exists (
      select 1 from public.time_off t
      where t.crew_id = src.crew_id and d between t.start_date and t.end_date
    );
  get diagnostics made = row_count;
  return made;
end;
$$;

-- Adds every shift from one Monday–Sunday week to another. Existing shifts in
-- the target week are kept. The copies share a batch id so they can be undone
-- together.
create function public.copy_week(p_from date, p_to date)
returns table (batch_id uuid, copied integer)
language plpgsql security invoker set search_path = '' as $$
declare
  batch uuid := gen_random_uuid();
  from_monday date := p_from - ((extract(isodow from p_from)::int) - 1);
  to_monday date := p_to - ((extract(isodow from p_to)::int) - 1);
  n integer;
begin
  perform public.require_admin();
  if from_monday = to_monday then
    raise exception 'Pick a different week to copy into.' using errcode = '22023';
  end if;

  insert into public.shifts (crew_id, shift_date, start_time, end_time, notes, copy_batch_id, created_by)
  select s.crew_id, s.shift_date + (to_monday - from_monday), s.start_time, s.end_time, s.notes, batch, auth.uid()
  from public.shifts s
  join public.crew c on c.id = s.crew_id
  where s.shift_date between from_monday and from_monday + 6
    and c.archived_at is null;
  get diagnostics n = row_count;
  return query select batch, n;
end;
$$;

-- Removes the shifts one copy_week call added. Copies edited since are
-- removed too; the confirmation in the app says so.
create function public.undo_copy_week(p_batch_id uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
begin
  perform public.require_admin();
  delete from public.shifts where copy_batch_id = p_batch_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Moves one shift to another day for the same person.
--   p_expected_updated_at: the shift as the admin saw it; a newer edit wins.
--   p_expected_dest: ids of that person's shifts on the target day, as seen.
--   p_mode: 'merge' keeps them, 'replace' deletes them.
-- A day with that person's time off is blocked.
create function public.move_shift(
  p_shift_id uuid,
  p_expected_updated_at timestamptz,
  p_to date,
  p_expected_dest uuid[],
  p_mode text default 'merge'
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  src public.shifts;
  dest uuid[];
begin
  perform public.require_admin();
  if p_mode not in ('merge', 'replace') then
    raise exception 'Unknown move option.' using errcode = '22023';
  end if;

  select * into src from public.shifts where id = p_shift_id for update;
  if src.id is null then
    raise exception 'That shift no longer exists.' using errcode = 'P0002';
  end if;
  if src.updated_at is distinct from p_expected_updated_at then
    raise exception 'Someone else just changed this shift. Refresh and try again.' using errcode = '40001';
  end if;
  if src.shift_date = p_to then
    return;
  end if;
  if exists (
    select 1 from public.time_off t
    where t.crew_id = src.crew_id and p_to between t.start_date and t.end_date
  ) then
    raise exception 'That day is marked as time off.' using errcode = '23514';
  end if;

  select coalesce(array_agg(id order by id), '{}') into dest
  from (
    select id from public.shifts
    where crew_id = src.crew_id and shift_date = p_to
    for update
  ) d;
  if dest is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(p_expected_dest) x) then
    raise exception 'That day changed since you looked. Refresh and try again.' using errcode = '40001';
  end if;

  if p_mode = 'replace' then
    delete from public.shifts where id = any(dest);
  end if;
  update public.shifts set shift_date = p_to where id = src.id;
end;
$$;

revoke execute on function public.require_admin() from anon;
revoke execute on function public.duplicate_shift(uuid, date[]) from anon;
revoke execute on function public.copy_week(date, date) from anon;
revoke execute on function public.undo_copy_week(uuid) from anon;
revoke execute on function public.move_shift(uuid, timestamptz, date, uuid[], text) from anon;
