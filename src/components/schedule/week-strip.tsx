import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayOfMonth, longDay, shortWeekday } from '@/lib/dates';

import type { ScheduleData } from './types';

/** Seven tappable days. A dot marks days with shifts; the bar marks today. */
export function WeekStrip({
  data,
  days,
  selected,
  onSelect,
}: {
  data: ScheduleData;
  days: string[];
  selected: string;
  onSelect: (day: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.strip}>
      {days.map((d) => {
        const isSelected = d === selected;
        const isToday = d === data.today;
        const working = data.shifts.filter((s) => s.shift_date === d).length;
        const holiday = data.holidays.some((h) => h.holiday_date === d);
        return (
          <Pressable
            key={d}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${longDay(d)}${isToday ? ', today' : ''}${holiday ? ', office closed' : ''}${
              working ? `, ${working} shift${working === 1 ? '' : 's'}` : ''
            }`}
            onPress={() => onSelect(d)}
            style={({ pressed }) => [
              styles.day,
              {
                backgroundColor: isSelected ? theme.primary : pressed ? theme.surfaceMuted : 'transparent',
              },
            ]}>
            <AppText
              variant="caption"
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: isSelected ? theme.primaryText : isToday ? theme.accent : theme.textMuted,
              }}>
              {shortWeekday(d).slice(0, 3)}
            </AppText>
            <AppText
              variant="heading"
              style={{ color: isSelected ? theme.primaryText : isToday ? theme.accent : theme.text }}>
              {String(dayOfMonth(d))}
            </AppText>
            <View
              style={[
                styles.mark,
                {
                  backgroundColor: holiday
                    ? isSelected
                      ? theme.primaryText
                      : theme.accent
                    : working
                      ? isSelected
                        ? theme.primaryText
                        : theme.primary
                      : 'transparent',
                  width: holiday ? 14 : 6,
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, gap: 2 },
  mark: { height: 6, borderRadius: 3 },
});
