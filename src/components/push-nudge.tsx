import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePushStatus, useSetPush } from '@/features/push';
import { errorMessage } from '@/lib/confirm';

const SNOOZED_UNTIL = 'iteamcal.push-nudge-snoozed-until';
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** "Not now" hides the card on this device for a week. */
function snoozed() {
  try {
    return Number(globalThis.localStorage?.getItem(SNOOZED_UNTIL) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

/** Shown on the main screen after sign-in until push is on for this device (or snoozed). */
export function PushNudge() {
  const status = usePushStatus();
  const setPush = useSetPush();
  const [hidden, setHidden] = useState(snoozed);
  const s = status.data;
  if (hidden || (s !== 'off' && s !== 'needs-install')) return null;

  const dismiss = () => {
    try {
      globalThis.localStorage?.setItem(SNOOZED_UNTIL, String(Date.now() + WEEK));
    } catch {}
    setHidden(true);
  };

  return (
    <Card>
      <AppText variant="label">Turn on notifications for this device</AppText>
      <AppText variant="caption" muted>
        {s === 'needs-install'
          ? 'On iPhone, add iTeamCal to your Home Screen first (Share, then Add to Home Screen), then turn notifications on in Settings.'
          : 'Get a heads-up if you forget to clock in or out, when your time off is decided, and when the office sends news like shift changes or weather alerts.'}
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
