import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ColorDot } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayOfMonth, longDay, sameMonth, shortWeekday } from '@/lib/dates';
import { shiftConflicts } from '@/lib/schedule';

import type { ScheduleData } from './types';

const MAX_DOTS = 6;

/** A full seven-day calendar. Each day shows who works and who's off. */
export function MonthView({
  data,
  weeks,
  month,
  onPickDay,
}: {
  data: ScheduleData;
  weeks: string[][];
  month: string;
  onPickDay: (day: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={[styles.table, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.week}>
          {weeks[0].map((d) => (
            <AppText key={d} variant="caption" muted style={styles.weekday}>
              {shortWeekday(d).slice(0, 2)}
            </AppText>
          ))}
        </View>
        {weeks.map((week) => (
          <View
            key={week[0]}
            style={[styles.week, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            {week.map((d) => {
              const inMonth = sameMonth(d, month);
              const holiday = data.holidays.find((h) => h.holiday_date === d);
              const shifts = data.shifts.filter((s) => s.shift_date === d);
              const working = [...new Set(shifts.map((s) => s.crew_id))];
              const off = data.timeOff.filter((t) => t.start_date <= d && t.end_date >= d);
              const conflicted = shifts.some((s) => shiftConflicts(s, data.timeOff, data.holidays).length > 0);
              const isToday = d === data.today;
              const summary = [
                longDay(d),
                holiday ? `${holiday.name}, office closed` : null,
                working.length ? `${working.length} working` : null,
                off.length ? `${off.length} off` : null,
                conflicted ? 'has conflicts' : null,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={summary}
                  onPress={() => onPickDay(d)}
                  style={({ pressed }) => [
                    styles.day,
                    {
                      backgroundColor: pressed ? theme.primarySoft : holiday ? theme.surfaceMuted : undefined,
                      opacity: inMonth ? 1 : 0.45,
                    },
                  ]}>
                  <View style={[styles.dayNumber, isToday && { backgroundColor: theme.accent }]}>
                    <AppText variant="label" style={{ color: isToday ? theme.primaryText : theme.text, fontSize: 13 }}>
                      {String(dayOfMonth(d))}
                    </AppText>
                  </View>
                  {holiday ? (
                    <AppText
                      variant="caption"
                      numberOfLines={1}
                      style={{ color: theme.accent, fontSize: 11, lineHeight: 14, fontWeight: '600' }}>
                      {holiday.name}
                    </AppText>
                  ) : null}
                  <View style={styles.dots}>
                    {working.slice(0, MAX_DOTS).map((id) => (
                      <ColorDot key={id} color={data.crewById.get(id)?.color ?? theme.textMuted} size={8} />
                    ))}
                    {working.length > MAX_DOTS ? (
                      <AppText variant="caption" muted style={{ fontSize: 10, lineHeight: 10 }}>
                        {`+${working.length - MAX_DOTS}`}
                      </AppText>
                    ) : null}
                  </View>
                  {off.length ? (
                    <AppText
                      variant="caption"
                      numberOfLines={1}
                      style={{ fontSize: 11, lineHeight: 14, color: theme.accent }}>
                      {`${off.length} off`}
                    </AppText>
                  ) : null}
                  {conflicted ? (
                    <AppText
                      variant="caption"
                      style={{ fontSize: 11, lineHeight: 14, color: theme.danger, fontWeight: '700' }}>
                      ⚠
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <AppText variant="caption" muted>
        Dots are people working that day. Tap a day to open its week.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: Spacing.xs, fontWeight: '600' },
  day: { flex: 1, minHeight: 76, padding: 4, gap: 2 },
  dayNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, alignItems: 'center' },
});
