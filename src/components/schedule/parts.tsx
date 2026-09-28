import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { Shift, TimeOffEntry } from '@/features/schedule';
import { useTheme } from '@/hooks/use-theme';
import { type Conflict, shiftTimeLabel, timeOffLabel } from '@/lib/schedule';

/** One shift: crew color bar, times, notes, and any conflict. */
export function ShiftChip({
  shift,
  color,
  conflicts,
  title,
  onPress,
}: {
  shift: Shift;
  color: string;
  conflicts: Conflict[];
  /** Shown above the time, e.g. the crew name in list and day views. */
  title?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const conflicted = conflicts.length > 0;
  const time = shiftTimeLabel(shift);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, time, shift.notes, ...conflicts.map((c) => `Conflict: ${c.label}`)]
        .filter(Boolean)
        .join('. ')}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderRadius: Radius.sm,
        paddingVertical: 5,
        paddingHorizontal: Spacing.sm,
        backgroundColor: conflicted ? theme.dangerSoft : theme.surfaceMuted,
        borderWidth: conflicted ? 1 : 0,
        borderColor: theme.danger,
        opacity: pressed ? 0.75 : 1,
        gap: 1,
      })}>
      {title ? (
        <AppText variant="label" numberOfLines={1}>
          {title}
        </AppText>
      ) : null}
      <AppText variant={title ? 'caption' : 'label'} numberOfLines={1}>
        {time}
      </AppText>
      {shift.notes ? (
        <AppText variant="caption" muted numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>
          {shift.notes}
        </AppText>
      ) : null}
      {conflicts.map((c) => (
        <AppText
          key={c.kind}
          variant="caption"
          numberOfLines={2}
          style={{ color: theme.danger, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
          {`⚠ ${c.label}`}
        </AppText>
      ))}
    </Pressable>
  );
}

/** A day someone is off. Sick days get the warmer warning treatment. */
export function TimeOffChip({ entry, title }: { entry: TimeOffEntry; title?: string }) {
  const theme = useTheme();
  const sick = entry.type === 'sick';
  const label = timeOffLabel(entry.type);
  return (
    <View
      accessibilityLabel={`${title ? `${title}, ` : ''}${label}`}
      style={{
        borderRadius: Radius.sm,
        paddingVertical: 5,
        paddingHorizontal: Spacing.sm,
        backgroundColor: sick ? theme.dangerSoft : theme.accentSoft,
        gap: 1,
      }}>
      {title ? (
        <AppText variant="label" numberOfLines={1}>
          {title}
        </AppText>
      ) : null}
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ color: sick ? theme.danger : theme.accent, fontWeight: '600', fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}
