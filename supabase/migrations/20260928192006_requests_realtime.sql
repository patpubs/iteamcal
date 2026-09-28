-- New and decided requests show up for admins and requesters without a refresh.
alter publication supabase_realtime add table public.time_off_requests;
