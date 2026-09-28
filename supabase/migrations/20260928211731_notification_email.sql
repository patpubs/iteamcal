-- Phase 6: email each new notification through Resend (PRD §11).
-- The database hands the notification id to the notify-email Edge Function,
-- which sends the email and records the result. Email trouble never undoes
-- the change that caused the notification or the in-app notification itself.

-- Local test databases don't ship pg_net; they skip email instead.
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net not available: %', sqlerrm;
end $$;

alter table public.notifications
  add column emailed_at timestamptz,
  add column email_error text;

-- Where to send new notifications. Left empty in local test databases, which
-- then skip email.
alter table public.settings add column email_hook_url text;

create function public.queue_notification_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  hook text := (select email_hook_url from public.settings limit 1);
begin
  if hook is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return new;
  end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using hook, jsonb_build_object('id', new.id), '{"Content-Type": "application/json"}'::jsonb;
  exception when others then
    raise warning 'notification email not queued: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.queue_notification_email() from anon, authenticated, public;

create trigger notifications_email after insert on public.notifications
  for each row execute function public.queue_notification_email();
