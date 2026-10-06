-- Approval copies the hours onto the day off, and the note says them.
create or replace function public.decide_time_off_request(
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
    insert into public.time_off (crew_id, start_date, end_date, start_time, end_time, type, reason, request_id, created_by)
    values (req.crew_id, req.start_date, req.end_date, req.start_time, req.end_time, req.type, req.reason, req.id, auth.uid());
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    req.requester_id,
    'request_decided',
    'Time off ' || req.status::text,
    'Your ' || req.type::text || ' request for '
      || public.time_off_text(req.requester_id, req.start_date, req.end_date, req.start_time, req.end_time)
      || ' was ' || req.status::text || '.'
      || coalesce(' Note: ' || req.decision_note, ''),
    '/time-off'
  );

  return req;
end;
$$;

create or replace function public.notify_new_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce((select name from public.crew where id = new.crew_id), 'Someone');
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'request_new',
         'Time off request from ' || who,
         initcap(new.type::text) || ', '
           || public.time_off_text(p.id, new.start_date, new.end_date, new.start_time, new.end_time) || '.'
           || coalesce(' "' || nullif(btrim(new.reason), '') || '"', ''),
         '/time-off?tab=requests'
  from public.profiles p
  where p.role = 'admin' and p.approval = 'approved' and p.id <> new.requester_id;
  return new;
end;
$$;
