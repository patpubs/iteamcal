-- Admin messages: choose push, email, or both.
drop function public.send_message(text, text, uuid[], boolean);

create function public.send_message(
  p_title text, p_body text, p_to uuid[] default null, p_push boolean default true, p_email boolean default false
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  title text := btrim(coalesce(p_title, ''));
  body text := btrim(coalesce(p_body, ''));
  sent integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can send messages.' using errcode = '42501';
  end if;
  if title = '' then
    raise exception 'Add a title.';
  end if;
  if length(title) > 80 then
    raise exception 'Keep the title under 80 characters.';
  end if;
  if length(body) > 500 then
    raise exception 'Keep the message under 500 characters.';
  end if;
  if not coalesce(p_push, false) and not coalesce(p_email, false) then
    raise exception 'Choose push, email, or both.';
  end if;
  insert into public.notifications (user_id, kind, title, body, link, send_push, send_email)
  select p.id, 'message', title, nullif(body, ''), '/more/notifications', coalesce(p_push, false), coalesce(p_email, false)
  from public.profiles p
  where p.approval = 'approved'
    and p.id is distinct from auth.uid()
    and (p_to is null or p.id = any (p_to));
  get diagnostics sent = row_count;
  if sent = 0 then
    raise exception 'Pick at least one person to send to.';
  end if;
  return sent;
end;
$$;
revoke execute on function public.send_message(text, text, uuid[], boolean, boolean) from anon, public;
grant execute on function public.send_message(text, text, uuid[], boolean, boolean) to authenticated;
