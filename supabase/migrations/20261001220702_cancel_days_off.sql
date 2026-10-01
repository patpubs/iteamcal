-- Cancelling days off.
-- 1. Staff cancel their own upcoming day off. Days already past stay on
--    record; admins are told.
-- 2. When an admin deletes or shortens someone's day off, that person is told.
-- 3. A request whose day off is cancelled shows as cancelled.
-- (Removing unapproved accounts is the remove-account Edge Function.)

create function public.days_text(p_from date, p_to date) returns text
language sql immutable set search_path = '' as $$
  select to_char(p_from, 'Dy Mon FMDD')
    || case when p_to <> p_from then ' – ' || to_char(p_to, 'Dy Mon FMDD') else '' end;
$$;
revoke execute on function public.days_text(date, date) from anon, authenticated, public;

-- Staff: cancel the rest of one of their days off. A range that hasn't started
-- is removed; one already under way keeps the days before today.
create function public.cancel_time_off(p_id uuid) returns void
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
         initcap(t.type::text) || ', ' || public.days_text(greatest(t.start_date, day), t.end_date) || '.',
         '/time-off'
  from public.profiles p
  where p.role = 'admin' and p.approval = 'approved' and p.id <> auth.uid();
end;
$$;
revoke execute on function public.cancel_time_off(uuid) from anon, public;

-- Keep the request history honest, and tell people when an admin removes
-- or shortens their day off.
create function public.on_time_off_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  self boolean := coalesce(current_setting('iteamcal.self_cancel', true), '') = 'on';
  owner uuid;
  gone_from date;
  gone_to date;
begin
  if tg_op = 'DELETE' then
    if old.request_id is not null then
      update public.time_off_requests set status = 'cancelled' where id = old.request_id and status = 'approved';
    end if;
    gone_from := old.start_date;
    gone_to := old.end_date;
  else
    -- Only a shortened range counts as removing days.
    if new.start_date <= old.start_date and new.end_date >= old.end_date then
      return null;
    end if;
    if new.end_date < old.end_date then
      gone_from := greatest(new.end_date + 1, old.start_date);
      gone_to := old.end_date;
    else
      gone_from := old.start_date;
      gone_to := least(new.start_date - 1, old.end_date);
    end if;
  end if;

  if self or gone_to < public.local_today() then
    return null;
  end if;
  select id into owner from public.profiles where crew_id = old.crew_id and approval = 'approved';
  if owner is null or owner = auth.uid() then
    return null;
  end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (owner, 'time_off_removed', 'Your day off was removed',
          'A manager removed ' || old.type::text || ' time off for '
            || public.days_text(greatest(gone_from, public.local_today()), gone_to) || '.',
          '/time-off');
  return null;
end;
$$;
revoke execute on function public.on_time_off_removed() from anon, authenticated, public;

create trigger time_off_removed after update or delete on public.time_off
  for each row execute function public.on_time_off_removed();
