import { Pressable, View } from 'react-native';

import { AppText, Button, Card, Divider, ErrorText, Screen, SectionTitle, SwitchRow } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePreferences, useSetTimeFormat } from '@/features/preferences';
import { useReminderSettings, usePushStatus, useSetPush, useSetRemindersEnabled } from '@/features/push';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/confirm';
import { TIME_FORMATS, type TimeFormat, formatTime, formatTimeRange } from '@/lib/time-format';
import { useAuth } from '@/providers/auth';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NAMES: Record<TimeFormat, string> = {
  full: 'Full',
  short: 'Short',
  '24h': '24-hour',
};

/** Personal settings, plus team-wide reminders for admins. */
export default function SettingsScreen() {
  const theme = useTheme();
  const prefs = usePreferences();
  const setFormat = useSetTimeFormat();
  const selected = prefs.data?.time_format ?? 'full';

  return (
    <Screen underHeader>
      <PushSection />
      <RemindersSection />

      <SectionTitle>Time format</SectionTitle>
      <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
        {TIME_FORMATS.map((f, i) => {
          const on = f.value === selected;
          return (
            <View key={f.value}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setFormat.mutate(f.value)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  minHeight: 56,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: Radius.pill,
                    borderWidth: 2,
                    borderColor: on ? theme.primary : theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {on ? (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary }} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{NAMES[f.value]}</AppText>
                  <AppText variant="caption" muted>
                    {formatTimeRange('09:00', '17:30', f.value)}
                  </AppText>
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>
      <ErrorText>{setFormat.error ? errorMessage(setFormat.error) : null}</ErrorText>
      <AppText variant="caption" muted>
        This only changes how times look for you. You can type times any way you like, such as 9, 9am, 9:30 PM, or
        14:30.
      </AppText>
    </Screen>
  );
}

function PushSection() {
  const { profile } = useAuth();
  const status = usePushStatus();
  const setPush = useSetPush();
  const s = status.data;

  let body = null;
  if (s === 'on' || s === 'off') {
    body = (
      <SwitchRow
        label="Push notifications on this device"
        help="Clock reminders and updates pop up here, even when the app is closed."
        value={setPush.isPending ? !!setPush.variables : s === 'on'}
        onValueChange={(on) => setPush.mutate(on)}
      />
    );
  } else if (s === 'needs-install') {
    body = (
      <View style={{ gap: Spacing.xs }}>
        <AppText variant="label">Add iTeamCal to your Home Screen first</AppText>
        <AppText muted>
          iPhone and iPad only allow notifications from apps on the Home Screen. In Safari, tap Share, then Add to Home
          Screen. Open iTeamCal from your Home Screen and come back here to turn notifications on.
        </AppText>
      </View>
    );
  } else if (s === 'blocked') {
    body = (
      <View style={{ gap: Spacing.xs }}>
        <AppText variant="label">Notifications are blocked</AppText>
        <AppText muted>
          This browser was told not to show notifications from iTeamCal. Allow them in the browser’s site settings, then
          come back here.
        </AppText>
        <Button compact variant="secondary" label="Check again" onPress={() => status.refetch()} />
      </View>
    );
  } else if (s === 'unsupported') {
    body = <AppText muted>This browser can’t show push notifications.</AppText>;
  }

  return (
    <>
      <SectionTitle>Notifications</SectionTitle>
      <Card>{body}</Card>
      <ErrorText>{setPush.error ? errorMessage(setPush.error) : null}</ErrorText>
      <AppText variant="caption" muted>
        {profile?.email
          ? `Notifications also go to ${profile.email}. Each device is set up on its own.`
          : 'Each device is set up on its own.'}
      </AppText>
    </>
  );
}

function RemindersSection() {
  const { isAdmin } = useAuth();
  const settings = useReminderSettings();
  const setEnabled = useSetRemindersEnabled();
  if (!isAdmin || !settings.data) return null;
  const { reminders_enabled, reminder_minutes, weekly_review_day, weekly_review_time } = settings.data;
  return (
    <>
      <SectionTitle>Reminders for the team</SectionTitle>
      <Card>
        <SwitchRow
          label="Automatic reminders"
          help={`“Did you forget to clock in?” when someone is ${reminder_minutes} minutes past the start of a scheduled shift without clocking in, and the same for clocking out. Every ${WEEKDAYS[weekly_review_day]} at ${formatTime(weekly_review_time)}, everyone who worked that week gets a reminder to review their hours. Sent by push and email.`}
          value={reminders_enabled}
          onValueChange={(on) => setEnabled.mutate(on)}
        />
      </Card>
      <ErrorText>{setEnabled.error ? errorMessage(setEnabled.error) : null}</ErrorText>
    </>
  );
}
