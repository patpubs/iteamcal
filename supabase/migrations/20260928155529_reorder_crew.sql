-- Schedule order for crew, set by admins from the weekly schedule. Runs with
-- the caller's rights, so row security still applies; the explicit check gives
-- staff a clear error instead of a silent no-op.
create function public.reorder_crew(p_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the schedule order.' using errcode = '42501';
  end if;
  update public.crew c
  set sort_order = o.pos
  from unnest(p_ids) with ordinality as o(id, pos)
  where c.id = o.id and c.sort_order is distinct from o.pos;
end;
$$;

revoke execute on function public.reorder_crew(uuid[]) from anon;

-- Other people's schedules pick up new crew, colors, and order right away.
alter publication supabase_realtime add table public.crew;
