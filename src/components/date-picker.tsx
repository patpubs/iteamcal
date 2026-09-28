import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, dayOfMonth, longDay, monthGrid, monthLabel, sameMonth, shortWeekday, today } from '@/lib/dates';

/**
 * A month calendar for picking one or more days. Big tap targets, Monday
 * start, and days can be disabled with a reason read to screen readers.
 */
export function DatePicker({
  selected,
  onPress,
  initialMonth,
  disabledReason,
  onMonthChange,
}: {
  selected: string[];
  onPress: (day: string) => void;
  initialMonth?: string;
  /** Return why a day can't be picked, or null when it can. */
  disabledReason?: (day: string) => string | null;
  onMonthChange?: (month: string) => void;
}) {
  const theme = useTheme();
  const now = today();
  const [month, setMonth] = useState(initialMonth ?? selected[0] ?? now);
  const weeks = monthGrid(month);

  function step(dir: -1 | 1) {
    const next = addMonths(month, dir);
    setMonth(next);
    onMonthChange?.(next);
  }

  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          label="Previous month"
          onPress={() => step(-1)}
        />
        <AppText variant="label" style={{ flex: 1, textAlign: 'center' }}>
          {monthLabel(month)}
        </AppText>
        <IconButton
          icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          label="Next month"
          onPress={() => step(1)}
        />
      </View>
      <View style={styles.week}>
        {weeks[0].map((d) => (
          <AppText key={d} variant="caption" muted style={styles.weekday}>
            {shortWeekday(d).slice(0, 2)}
          </AppText>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((d) => {
            const isSelected = selected.includes(d);
            const reason = disabledReason?.(d) ?? null;
            const inMonth = sameMonth(d, month);
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: !!reason }}
                accessibilityLabel={`${longDay(d)}${reason ? `, ${reason}` : ''}`}
                disabled={!!reason}
                onPress={() => onPress(d)}
                style={styles.cell}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.day,
                      {
                        backgroundColor: isSelected ? theme.primary : pressed ? theme.surfaceMuted : 'transparent',
                        borderColor: d === now && !isSelected ? theme.accent : 'transparent',
                        opacity: reason ? 0.3 : inMonth ? 1 : 0.5,
                      },
                    ]}>
                    <AppText
                      variant="label"
                      style={{
                        color: isSelected ? theme.primaryText : d === now ? theme.accent : theme.text,
                        textDecorationLine: reason ? 'line-through' : 'none',
                      }}>
                      {String(dayOfMonth(d))}
                    </AppText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '600' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
