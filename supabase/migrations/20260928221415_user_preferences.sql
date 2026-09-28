-- Personal display preferences. Each person reads and changes only their own
-- row; nothing else about their account becomes editable.
create table public.user_preferences (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- full = 9:00 AM, short = 9a, 24h = 09:00
  time_format text not null default 'full' check (time_format in ('full', 'short', '24h')),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

alter table public.user_preferences enable row level security;

create policy "read own preferences" on public.user_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "add own preferences" on public.user_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "change own preferences" on public.user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.user_preferences from anon;
