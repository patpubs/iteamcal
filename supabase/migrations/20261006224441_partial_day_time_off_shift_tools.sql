-- Copying or moving a shift skips days only when the time off overlaps its hours.
create or replace function public.duplicate_shift(p_shift_id uuid, p_dates date[]) returns integer
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
        and public.off_overlaps(t.start_time, t.end_time, src.start_time, src.end_time)
    );
  get diagnostics made = row_count;
  return made;
end;
$$;

create or replace function public.move_shift(
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
      and public.off_overlaps(t.start_time, t.end_time, src.start_time, src.end_time)
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
