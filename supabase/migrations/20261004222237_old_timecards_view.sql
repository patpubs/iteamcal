-- Admins can read old-app timecards for crew who never signed in to the new
-- app (someone who left, or hasn't joined yet). The cards stay staged, so
-- they still move onto the account if that person signs in later.
create function public.old_timecards(p_from date, p_to date)
returns table (
  crew_id uuid,
  work_date date,
  start_time time,
  lunch_start time,
  lunch_end time,
  end_time time,
  net_hours numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see old timecards.' using errcode = '42501';
  end if;
  return query
    select i.crew_id, l.work_date, l.start_time, l.lunch_start, l.lunch_end, l.end_time,
      case when l.end_time is null then null
      else round(
        (extract(epoch from (l.end_time - l.start_time))
          - coalesce(extract(epoch from (l.lunch_end - l.lunch_start)), 0)) / 3600.0, 2)
      end
    from public.legacy_timecards l
    join public.account_invites i on i.legacy_user_id = l.legacy_user_id
    where i.claimed_by is null and i.crew_id is not null
      and l.work_date between p_from and p_to
    order by l.work_date;
end;
$$;

revoke execute on function public.old_timecards(date, date) from anon, public;
grant execute on function public.old_timecards(date, date) to authenticated;
