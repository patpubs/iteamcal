import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Enums, Tables, TablesInsert } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;
export type Crew = Tables<'crew'>;
export type Invite = Tables<'account_invites'>;

// Colors offered for crew. Chosen to stay readable as text and as a fill in
// both light and dark mode.
export const CREW_COLORS = [
  '#3B6EA8',
  '#1F8A70',
  '#C0582B',
  '#8E4EC6',
  '#B8860B',
  '#D1467C',
  '#2A9DB5',
  '#6B8E23',
  '#A0522D',
  '#5B6ACF',
  '#C23B3B',
  '#4A7C59',
];

/** First palette color no active crew member uses, so new people stand out. */
export function suggestColor(crew: Crew[]): string {
  const used = new Set(crew.filter((c) => !c.archived_at).map((c) => c.color.toUpperCase()));
  return CREW_COLORS.find((c) => !used.has(c.toUpperCase())) ?? CREW_COLORS[crew.length % CREW_COLORS.length];
}

export function useCrew() {
  return useQuery({
    queryKey: ['crew'],
    queryFn: async () => {
      const { data, error } = await supabase.from('crew').select('*').order('sort_order').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Pre-approved emails that haven't signed in yet. */
export function useOpenInvites() {
  return useQuery({
    queryKey: ['invites'],
    queryFn: async () => {
      const { data, error } = await supabase.from('account_invites').select('*').is('claimed_at', null).order('email');
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('account_invites').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['invites'] }),
  });
}

/** How a person is named across the app: crew name if linked, else account name. */
export function displayName(profile: Profile, crew: Crew[] | undefined) {
  const linked = profile.crew_id ? crew?.find((c) => c.id === profile.crew_id) : undefined;
  return linked?.name ?? profile.display_name ?? profile.email ?? 'Unknown';
}

type ProfileChange = {
  role?: Enums<'app_role'>;
  approval?: Enums<'approval_status'>;
  crew_id?: string | null;
  timecard_alerts?: boolean;
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: { id: string; change: ProfileChange }) => {
      const { error } = await supabase.from('profiles').update(change).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

/** Admins remove an account that was never approved or was turned away. */
export function useRemoveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('remove-account', { body: { id } });
      if (error) {
        // The function answers with {"error": "..."} that people can act on.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? 'Couldn’t remove the account. Try again.');
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useSaveCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TablesInsert<'crew'> }) => {
      if (id) {
        const { error } = await supabase.from('crew').update(values).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('crew').insert(values).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['crew'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useSetCrewArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('crew')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['crew'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useDeleteCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crew').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries(),
  });
}
