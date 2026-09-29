import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { pushStatus, registerServiceWorker, syncPush, turnOffPush, turnOnPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

/** Whether this device gets push notifications. */
export function usePushStatus() {
  return useQuery({ queryKey: ['push-status'], queryFn: pushStatus, staleTime: 0 });
}

export function useSetPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => (on ? turnOnPush() : turnOffPush()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push-status'] }),
  });
}

/** Registers the service worker and re-links this device on start. Mounted once, in the signed-in layout. */
export function useSyncPush() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile) return;
    registerServiceWorker().then(() => syncPush());
  }, [profile]);
}

export type ReminderSettings = {
  reminders_enabled: boolean;
  reminder_minutes: number;
  weekly_review_day: number;
  weekly_review_time: string;
};

/** Team-wide reminder settings; admins can change them. */
export function useReminderSettings() {
  return useQuery({
    queryKey: ['reminder-settings'],
    queryFn: async (): Promise<ReminderSettings> => {
      const { data, error } = await supabase
        .from('settings')
        .select('reminders_enabled, reminder_minutes, weekly_review_day, weekly_review_time')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSetRemindersEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.from('settings').update({ reminders_enabled: on }).eq('id', true);
      if (error) throw error;
    },
    onMutate: (on) =>
      queryClient.setQueryData<ReminderSettings>(['reminder-settings'], (old) =>
        old ? { ...old, reminders_enabled: on } : old,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['reminder-settings'] }),
  });
}
