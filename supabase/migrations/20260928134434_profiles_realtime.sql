-- Let the app hear about its own role and approval changes right away (PRD §3).
alter publication supabase_realtime add table public.profiles;
