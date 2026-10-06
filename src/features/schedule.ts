import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Tables, TablesInsert } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Shift = Tables<'shifts'>;
export type Holiday = Tables<'holidays'>;
export type TimeOffEntry = {
  id: string;
  crew_id: string;
  start_date: string;
  end_date: string;
  type: Tables<'time_off'>['type'] | null;
  reason: string | null;
  start_time: string | null;
  end_time: string | null;
};

/** Shifts, time off, and holidays for an inclusive date range. */
export function useScheduleRange(from: string, to: string) {
  const shifts = useQuery({
    queryKey: ['schedule', 'shifts', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .order('shift_date')
        .order('start_time', { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
  const timeOff = useQuery({
    queryKey: ['schedule', 'time-off', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('time_off_hours_in_range', { p_from: from, p_to: to });
      if (error) throw error;
      return data as TimeOffEntry[];
    },
  });
  const holidays = useHolidays(from, to);
  return { shifts, timeOff, holidays };
}

export function useHolidays(from: string, to: string) {
  return useQuery({
    queryKey: ['schedule', 'holidays', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('holiday_date', from)
        .lte('holiday_date', to)
        .order('holiday_date');
      if (error) throw error;
      return data;
    },
  });
}

/** Keeps every open schedule current when anyone changes it. */
export function useScheduleRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = (key: string[]) => () => queryClient.invalidateQueries({ queryKey: key });
    const channel = supabase
      .channel('schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, refresh(['schedule', 'shifts']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off' }, refresh(['schedule', 'time-off']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, refresh(['schedule', 'holidays']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crew' }, refresh(['crew']))
      // Publishing changes which shifts staff can see.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_weeks' }, refresh(['schedule']))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useShift(id: string | undefined) {
  return useQuery({
    queryKey: ['schedule', 'shifts', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

type ShiftValues = Pick<TablesInsert<'shifts'>, 'crew_id' | 'shift_date' | 'start_time' | 'end_time' | 'notes'>;

export function useSaveShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ShiftValues }) => {
      const { error } = id
        ? await supabase.from('shifts').update(values).eq('id', id)
        : await supabase.from('shifts').insert(values);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule', 'shifts'] }),
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule', 'shifts'] }),
  });
}

export function useSaveHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: { holiday_date: string; name: string } }) => {
      const { error } = id
        ? await supabase.from('holidays').update(values).eq('id', id)
        : await supabase.from('holidays').insert(values);
      if (error) {
        if (error.code === '23505') throw new Error('There’s already a holiday on that date.');
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule', 'holidays'] }),
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule', 'holidays'] }),
  });
}

/** Saves a new schedule order; the list shows the new order immediately. */
export function useReorderCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_crew', { p_ids: ids });
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['crew'] });
      const previous = queryClient.getQueryData<Tables<'crew'>[]>(['crew']);
      if (previous) {
        const pos = new Map(ids.map((id, i) => [id, i + 1]));
        queryClient.setQueryData(
          ['crew'],
          [...previous]
            .map((c) => (pos.has(c.id) ? { ...c, sort_order: pos.get(c.id)! } : c))
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
        );
      }
      return { previous };
    },
    onError: (_e, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(['crew'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['crew'] }),
  });
}

const refreshShifts = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ['schedule', 'shifts'] });

/** Copies one shift onto other days. Days the person is off are skipped. */
export function useDuplicateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dates }: { id: string; dates: string[] }) => {
      const { data, error } = await supabase.rpc('duplicate_shift', { p_shift_id: id, p_dates: dates });
      if (error) throw error;
      return data;
    },
    onSettled: () => refreshShifts(queryClient),
  });
}

export function useCopyWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { data, error } = await supabase.rpc('copy_week', { p_from: from, p_to: to });
      if (error) throw error;
      return data[0];
    },
    onSettled: () => refreshShifts(queryClient),
  });
}

export function useUndoCopyWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.rpc('undo_copy_week', { p_batch_id: batchId });
      if (error) throw error;
      return data;
    },
    onSettled: () => refreshShifts(queryClient),
  });
}

export function useMoveShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { shift: Shift; to: string; expectedDest: string[]; mode: 'merge' | 'replace' }) => {
      const { error } = await supabase.rpc('move_shift', {
        p_shift_id: args.shift.id,
        p_expected_updated_at: args.shift.updated_at,
        p_to: args.to,
        p_expected_dest: args.expectedDest,
        p_mode: args.mode,
      });
      if (error) throw error;
    },
    onSettled: () => refreshShifts(queryClient),
  });
}

/** The published state of the Monday–Sunday week starting `week`; null while it's a draft. */
export function useScheduleWeek(week: string) {
  return useQuery({
    queryKey: ['schedule', 'week', week],
    queryFn: async () => {
      const { data, error } = await supabase.from('schedule_weeks').select('*').eq('week_start', week).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Admins: the crew that publishing (or sending an update for) this week would tell. */
export function useWeekRecipients(week: string, enabled: boolean) {
  return useQuery({
    queryKey: ['schedule', 'week-recipients', week],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('week_recipients', { p_week: week });
      if (error) throw error;
      return data;
    },
  });
}

export function usePublishWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ week, notify }: { week: string; notify: boolean }) => {
      const { data, error } = await supabase.rpc('publish_week', { p_week: week, p_notify: notify });
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useUnpublishWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (week: string) => {
      const { error } = await supabase.rpc('unpublish_week', { p_week: week });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });
}
