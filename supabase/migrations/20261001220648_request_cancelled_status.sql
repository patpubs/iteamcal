-- Requests whose day off is later cancelled show as cancelled.
alter type public.request_status add value if not exists 'cancelled';
