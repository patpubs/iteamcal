import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Loading,
  Screen,
  SectionTitle,
  Segmented,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { displayName, useCrew, useProfiles } from '@/features/team';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

const QUICK = ['Shift change', 'Weather alert', 'Office closed', 'Reminder'];

type Audience = 'everyone' | 'choose';
type Channel = 'push' | 'email' | 'both';

const CHANNEL_WORDS: Record<Channel, string> = { push: 'by push', email: 'by email', both: 'by push and email' };

/** Admins send a short push message to everyone or to chosen people. */
export default function MessageScreen() {
  const theme = useTheme();
  const { profile: me } = useAuth();
  const profiles = useProfiles();
  const crew = useCrew();
  const ready = useQuery({
    queryKey: ['push-ready-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('push_ready_users');
      if (error) throw error;
      return new Set(data as string[]);
    },
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<Channel>('push');
  const push = channel !== 'email';
  const email = channel !== 'push';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const people = useMemo(
    () =>
      (profiles.data ?? [])
        .filter((p) => p.approval === 'approved' && p.id !== me?.id)
        .map((p) => ({
          id: p.id,
          name: displayName(p, crew.data),
          color: p.crew_id ? crew.data?.find((c) => c.id === p.crew_id)?.color : undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [profiles.data, crew.data, me?.id],
  );

  if (profiles.isPending || crew.isPending) return <Loading />;

  const recipients = audience === 'everyone' ? people : people.filter((p) => picked.has(p.id));
  const withPush = ready.data ? recipients.filter((p) => ready.data.has(p.id)) : [];
  const withoutPush = ready.data ? recipients.filter((p) => !ready.data.has(p.id)) : [];

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function onSend() {
    setError(null);
    setSent(null);
    if (!title.trim()) return setError('Add a title.');
    if (!recipients.length) return setError('Pick at least one person to send to.');
    const who =
      audience === 'everyone'
        ? `everyone (${recipients.length})`
        : `${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`;
    const ok = await confirmAction(`Send to ${who}?`, `“${title.trim()}” ${CHANNEL_WORDS[channel]}.`, 'Send');
    if (!ok) return;
    setBusy(true);
    const { data, error: sendError } = await supabase.rpc('send_message', {
      p_title: title,
      p_body: body,
      p_to: audience === 'everyone' ? undefined : [...picked],
      p_push: push,
      p_email: email,
    });
    setBusy(false);
    if (sendError) return setError(errorMessage(sendError));
    setSent(`Sent to ${data} ${data === 1 ? 'person' : 'people'}.`);
    setTitle('');
    setBody('');
    setPicked(new Set());
  }

  return (
    <Screen underHeader>
      <SectionTitle>Message</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {QUICK.map((q) => (
          <Chip key={q} label={q} selected={title === q} onPress={() => setTitle(q)} />
        ))}
      </View>
      <Card>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Weather alert" maxLength={80} />
        <Field
          label="Message"
          value={body}
          onChangeText={setBody}
          placeholder="e.g. The office opens at 10 tomorrow because of the storm."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <AppText variant="caption" muted style={{ textAlign: 'right' }}>
          {`${body.length}/500`}
        </AppText>
      </Card>

      <SectionTitle>Send to</SectionTitle>
      <Segmented
        options={[
          { value: 'everyone', label: 'Everyone' },
          { value: 'choose', label: 'Choose people' },
        ]}
        value={audience}
        onChange={setAudience}
      />
      {audience === 'choose' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {people.map((p) => (
            <Chip key={p.id} label={p.name} color={p.color} selected={picked.has(p.id)} onPress={() => toggle(p.id)} />
          ))}
        </View>
      ) : null}

      <SectionTitle>Send by</SectionTitle>
      <Segmented
        options={[
          { value: 'push', label: 'Push' },
          { value: 'email', label: 'Email' },
          { value: 'both', label: 'Both' },
        ]}
        value={channel}
        onChange={setChannel}
      />
      <AppText variant="caption" muted>
        It also shows in everyone’s inbox in the app.
      </AppText>

      {push && recipients.length && ready.data ? (
        <AppText variant="caption" muted>
          {withoutPush.length === 0
            ? `All ${recipients.length} have push turned on.`
            : `${withPush.length} of ${recipients.length} have push turned on. ${
                email ? 'The rest will get the email' : 'The rest will only see it in the app'
              }: ${withoutPush.map((p) => p.name).join(', ')}.`}
        </AppText>
      ) : null}

      <ErrorText>{error}</ErrorText>
      {sent ? (
        <AppText variant="label" style={{ color: theme.primary }}>
          {sent}
        </AppText>
      ) : null}
      <Button label="Send" loading={busy} onPress={onSend} />
    </Screen>
  );
}
