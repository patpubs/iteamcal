import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useCrew } from '@/features/team';
import type { Database, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { CardTimes } from '@/lib/timecards';
import { useAuth } from '@/providers/auth';

export type Timecard = Tables<'timecards'>;
export type PunchAction = Database['public']['Functions']['punch']['Args']['p_action'];

/**
 * Cards in an inclusive date range. Row security limits staff to their own;
 * pass a user to narrow an admin's view to one person.
 */
export function useTimecards(from: string, to: string, userId?: string) {
  return useQuery({
    queryKey: ['timecards', 'range', from, to, userId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('timecards').select('*').gte('work_date', from).lte('work_date', to);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.order('work_date');
      if (error) throw error;
      return data;
    },
  });
}

export function useTimecard(id: string | undefined) {
  return useQuery({
    queryKey: ['timecards', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('timecards').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Keeps open timecard screens current, such as the admin crew view while people punch. */
export function useTimecardsRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('timecards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timecards' }, () =>
        queryClient.invalidateQueries({ queryKey: ['timecards'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** One-tap punches. The server stamps its own clock, in team time. */
export function usePunch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: PunchAction) => {
      const { data, error } = await supabase.rpc('punch', { p_action: action });
      if (error) throw error;
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['timecards'] }),
  });
}

export function useSaveTimecard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; userId: string; workDate: string; times: CardTimes }) => {
      const { error } = args.id
        ? await supabase.from('timecards').update(args.times).eq('id', args.id)
        : await supabase.from('timecards').insert({ ...args.times, user_id: args.userId, work_date: args.workDate });
      if (error) {
        if (error.code === '23505') throw new Error('There’s already a timecard for that day.');
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['timecards'] }),
  });
}

export function useDeleteTimecard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('timecards').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('This timecard was already deleted.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['timecards'] }),
  });
}

/**
 * True when the signed-in person's crew member is set to not need timecards
 * (PRD §10). Undefined while loading. The database enforces the same rule.
 */
export function useTimecardsHidden(): boolean | undefined {
  const { profile } = useAuth();
  const crew = useCrew();
  if (!profile) return undefined;
  if (!profile.crew_id) return false;
  if (!crew.data) return undefined;
  return !!crew.data.find((c) => c.id === profile.crew_id)?.hide_timecards;
}
