import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { type TimeFormat, setTimeFormat } from '@/lib/time-format';
import { useAuth } from '@/providers/auth';

/** The signed-in person's display preferences; defaults when they've never changed them. */
export function usePreferences() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['preferences', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', profile!.id)
        .maybeSingle();
      if (error) throw error;
      return { time_format: (data?.time_format ?? 'full') as TimeFormat };
    },
  });
}

/** Applies saved preferences app-wide. Mounted once, in the signed-in layout. */
export function useApplyPreferences() {
  const { data } = usePreferences();
  useEffect(() => {
    if (data) setTimeFormat(data.time_format);
  }, [data]);
}

export function useSetTimeFormat() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (format: TimeFormat) => {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: profile!.id, time_format: format }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    // Show the new style right away; roll back if saving fails.
    onMutate: (format) => {
      const previous = queryClient.getQueryData<{ time_format: TimeFormat }>(['preferences', profile?.id]);
      queryClient.setQueryData(['preferences', profile?.id], { time_format: format });
      return { previous };
    },
    onError: (_e, _f, context) => {
      if (context?.previous) queryClient.setQueryData(['preferences', profile?.id], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });
}
