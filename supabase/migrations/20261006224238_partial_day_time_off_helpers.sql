-- True when time off (whole day, or the given hours) overlaps a shift's hours.
-- A shift without times counts as the whole day.
create function public.off_overlaps(p_off_start time, p_off_end time, p_shift_start time, p_shift_end time)
returns boolean
language sql immutable set search_path = '' as $$
  select p_off_start is null
      or (p_off_start < coalesce(p_shift_end, '24:00'::time) and p_off_end > coalesce(p_shift_start, '00:00'::time));
$$;
grant execute on function public.off_overlaps(time, time, time, time) to authenticated;

-- "Mon Oct 5", "Mon Oct 5 – Wed Oct 7", or "Mon Oct 5, 12:00 PM – 5:00 PM"
-- in the reader's time format.
create function public.time_off_text(p_user uuid, p_from date, p_to date, p_start time, p_end time)
returns text
language sql stable security definer set search_path = '' as $$
  select public.days_text(p_from, p_to)
    || case when p_start is not null
            then ', ' || public.format_time_for(p_user, p_start) || ' – ' || public.format_time_for(p_user, p_end)
            else '' end;
$$;
revoke execute on function public.time_off_text(uuid, date, date, time, time) from anon, authenticated, public;
