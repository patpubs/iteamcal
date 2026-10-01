import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Enums, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type TimeOff = Tables<'time_off'>;
export type TimeOffRequest = Tables<'time_off_requests'>;
export type TimeOffType = Enums<'time_off_type'>;

export const TIME_OFF_TYPES: { value: TimeOffType; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
];

/**
 * Recorded days off overlapping a range. Row security limits staff to their
 * own crew member; admins see everyone, including full-time crew.
 */
export function useTimeOffEntries(from: string, to: string) {
  return useQuery({
    queryKey: ['time-off', 'entries', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_off')
        .select('*')
        .lte('start_date', to)
        .gte('end_date', from)
        .order('start_date');
      if (error) throw error;
      return data;
    },
  });
}

export function useTimeOffEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['time-off', 'entry', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('time_off').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Pending requests plus the 50 most recent decisions (own only, for staff). */
export function useRequests() {
  const pending = useQuery({
    queryKey: ['time-off', 'requests', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('status', 'pending')
        .order('start_date');
      if (error) throw error;
      return data;
    },
  });
  const decided = useQuery({
    queryKey: ['time-off', 'requests', 'decided'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('*')
        .neq('status', 'pending')
        .order('decided_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  return { pending, decided };
}

/** Keeps time off current for everyone when entries or requests change. */
export function useTimeOffRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', 'time-off'] });
    };
    const channel = supabase
      .channel('time-off')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off_requests' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['time-off'] }),
      queryClient.invalidateQueries({ queryKey: ['schedule', 'time-off'] }),
    ]);
}

type RequestValues = { start_date: string; end_date: string; type: TimeOffType; reason: string | null };

export function useSubmitRequest() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({
      requesterId,
      crewId,
      values,
    }: {
      requesterId: string;
      crewId: string;
      values: RequestValues;
    }) => {
      const { error } = await supabase
        .from('time_off_requests')
        .insert({ ...values, requester_id: requesterId, crew_id: crewId });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export function useCancelRequest() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      // Row security only lets a requester delete their own pending request;
      // anything else deletes nothing, so check the count.
      const { error, count } = await supabase.from('time_off_requests').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('This request was already decided, so it can’t be cancelled.');
    },
    onSettled: refresh,
  });
}

/** Staff cancel their own upcoming day off (days already past stay on record). */
export function useCancelTimeOff() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_time_off', { p_id: id });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export function useDecideRequest() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc('decide_time_off_request', {
        p_request_id: id,
        p_approve: approve,
        p_note: note ?? '',
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

type EntryValues = RequestValues & { crew_id: string };

export function useSaveTimeOff() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: EntryValues }) => {
      const { error } = id
        ? await supabase.from('time_off').update(values).eq('id', id)
        : await supabase.from('time_off').insert(values);
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export function useDeleteTimeOff() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_off').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: refresh,
  });
}
