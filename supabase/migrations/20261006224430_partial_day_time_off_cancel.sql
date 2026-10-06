create or replace function public.cancel_time_off(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.time_off;
  day date := public.local_today();
  who text;
begin
  if not public.is_approved() then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into t from public.time_off where id = p_id for update;
  if not found or t.crew_id is distinct from public.my_crew_id() then
    raise exception 'That day off isn’t yours to cancel.' using errcode = '42501';
  end if;
  if t.end_date < day then
    raise exception 'That day off is already over.' using errcode = 'P0001';
  end if;

  perform set_config('iteamcal.self_cancel', 'on', true);
  if t.start_date >= day then
    delete from public.time_off where id = t.id;
  else
    update public.time_off set end_date = day - 1 where id = t.id;
  end if;
  perform set_config('iteamcal.self_cancel', 'off', true);

  select name into who from public.crew where id = t.crew_id;
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'time_off_cancelled', coalesce(who, 'Someone') || ' cancelled time off',
         initcap(t.type::text) || ', '
           || public.time_off_text(p.id, greatest(t.start_date, day), t.end_date, t.start_time, t.end_time) || '.',
         '/time-off'
  from public.profiles p
  where p.role = 'admin' and p.approval = 'approved' and p.id <> auth.uid();
end;
$$;
