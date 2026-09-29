import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePushStatus, useSetPush } from '@/features/push';
import { errorMessage } from '@/lib/confirm';

const DISMISSED = 'iteamcal.push-nudge-dismissed';

function dismissedBefore() {
  try {
    return globalThis.localStorage?.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
}

/** Invites people to turn on push on this device, so clock reminders reach them. */
export function PushNudge() {
  const status = usePushStatus();
  const setPush = useSetPush();
  const [hidden, setHidden] = useState(dismissedBefore);
  const s = status.data;
  if (hidden || (s !== 'off' && s !== 'needs-install')) return null;

  const dismiss = () => {
    try {
      globalThis.localStorage?.setItem(DISMISSED, '1');
    } catch {}
    setHidden(true);
  };

  return (
    <Card>
      <AppText variant="label">Get clock reminders on this device</AppText>
      <AppText variant="caption" muted>
        {s === 'needs-install'
          ? 'On iPhone, add iTeamCal to your Home Screen first (Share, then Add to Home Screen), then turn notifications on in Settings.'
          : 'A quick nudge if you forget to clock in or out, plus updates on your time off.'}
      </AppText>
      <ErrorText>{setPush.error ? errorMessage(setPush.error) : null}</ErrorText>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {s === 'off' ? (
          <Button compact label="Turn on" loading={setPush.isPending} onPress={() => setPush.mutate(true)} />
        ) : (
          <Button compact label="How to" onPress={() => router.push('/more/settings')} />
        )}
        <Button compact variant="secondary" label="Not now" onPress={dismiss} />
      </View>
    </Card>
  );
}
