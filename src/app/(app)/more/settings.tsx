import { Pressable, View } from 'react-native';

import { AppText, Card, Divider, ErrorText, Screen, SectionTitle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePreferences, useSetTimeFormat } from '@/features/preferences';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/confirm';
import { TIME_FORMATS, type TimeFormat, formatTimeRange } from '@/lib/time-format';

const NAMES: Record<TimeFormat, string> = {
  full: 'Full',
  short: 'Short',
  '24h': '24-hour',
};

/** Personal settings. Only affects how the app looks for you. */
export default function SettingsScreen() {
  const theme = useTheme();
  const prefs = usePreferences();
  const setFormat = useSetTimeFormat();
  const selected = prefs.data?.time_format ?? 'full';

  return (
    <Screen underHeader>
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
