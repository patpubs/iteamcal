-- The shared schedule needs the hours too. A new function, so the copy of
-- the app people already have open keeps working until it updates.
create function public.time_off_hours_in_range(p_from date, p_to date)
returns table (
  id uuid,
  crew_id uuid,
  start_date date,
  end_date date,
  type public.time_off_type,
  reason text,
  start_time time,
  end_time time
)
language sql stable security definer set search_path = '' as $$
  select
    t.id, t.crew_id, t.start_date, t.end_date,
    case when public.is_admin() or t.crew_id = public.my_crew_id()
              or (select staff_see_coworker_time_off_details from public.settings limit 1)
         then t.type end,
    case when public.is_admin() or t.crew_id = public.my_crew_id()
         then t.reason end,
    t.start_time, t.end_time
  from public.time_off t
  where public.is_approved()
    and t.start_date <= p_to
    and t.end_date >= p_from;
$$;
revoke execute on function public.time_off_hours_in_range(date, date) from anon, public;
grant execute on function public.time_off_hours_in_range(date, date) to authenticated;
