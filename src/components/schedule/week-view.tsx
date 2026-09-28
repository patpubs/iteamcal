import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, ColorDot, ErrorText, IconButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useReorderCrew } from '@/features/schedule';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/confirm';
import { dayOfMonth, shortWeekday } from '@/lib/dates';
import { moveId, shiftConflicts, sortShifts, timeOffOn, visibleWeekDays } from '@/lib/schedule';

import { ShiftChip, TimeOffChip } from './parts';
import type { ScheduleData } from './types';

const NAME_WIDTH = 96;
const DAY_MIN_WIDTH = 104;

/** Crew down the side, days across the top. Scrolls sideways on phones. */
export function WeekView({
  data,
  days,
  isAdmin,
  reordering,
}: {
  data: ScheduleData;
  days: string[];
  isAdmin: boolean;
  reordering: boolean;
}) {
  const theme = useTheme();
  const reorder = useReorderCrew();
  const [heights, setHeights] = useState<{ left: Record<string, number>; right: Record<string, number> }>({
    left: {},
    right: {},
  });
  const shown = useMemo(() => visibleWeekDays(days, data), [days, data]);
  const holidayOn = (d: string) => data.holidays.find((h) => h.holiday_date === d);

  if (data.crew.length === 0) {
    return (
      <AppText muted>
        {isAdmin ? 'Add crew on More → Crew to start the schedule.' : 'No one is on the schedule yet.'}
      </AppText>
    );
  }

  const ids = data.crew.map((c) => c.id);

  // Names stay pinned on the left while the days scroll sideways. The day row
  // grows to fit the name's natural height, and the name cell then matches the
  // day row, so neither side can hold the other open after content shrinks.
  const measure = (side: 'left' | 'right', key: string) => (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeights((prev) => (prev[side][key] === h ? prev : { ...prev, [side]: { ...prev[side], [key]: h } }));
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={[styles.table, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {/* Pinned name column */}
        <View style={[styles.nameColumn, { borderRightColor: theme.border }]}>
          <View style={[styles.divider, { minHeight: heights.right.head, borderBottomColor: theme.border }]} />
          {data.crew.map((c, rowIndex) => (
            <View
              key={c.id}
              style={[
                { minHeight: heights.right[c.id], justifyContent: 'center' },
                rowIndex < data.crew.length - 1 && [styles.divider, { borderBottomColor: theme.border }],
              ]}>
              <View onLayout={measure('left', c.id)} style={styles.nameCell}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ColorDot color={c.color} size={10} />
                  <AppText variant="label" numberOfLines={2} style={{ flex: 1 }}>
                    {c.name}
                  </AppText>
                </View>
                {reordering ? (
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton
                      icon={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                      label={`Move ${c.name} up`}
                      disabled={rowIndex === 0 || reorder.isPending}
                      onPress={() => reorder.mutate(moveId(ids, c.id, -1))}
                    />
                    <IconButton
                      icon={{ ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' }}
                      label={`Move ${c.name} down`}
                      disabled={rowIndex === data.crew.length - 1 || reorder.isPending}
                      onPress={() => reorder.mutate(moveId(ids, c.id, 1))}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1, minWidth: DAY_MIN_WIDTH * shown.length }}>
            {/* Day headings */}
            <View
              onLayout={measure('right', 'head')}
              style={[styles.row, styles.divider, { borderBottomColor: theme.border }]}>
              {shown.map((d) => {
                const holiday = holidayOn(d);
                const isToday = d === data.today;
                return (
                  <View
                    key={d}
                    accessibilityRole="header"
                    style={[
                      styles.dayCell,
                      styles.headCell,
                      { backgroundColor: isToday ? theme.accentSoft : undefined },
                    ]}>
                    <AppText
                      variant="caption"
                      muted
                      style={isToday ? { color: theme.accent, fontWeight: '700' } : undefined}>
                      {shortWeekday(d).toUpperCase()}
                    </AppText>
                    <AppText variant="heading" style={isToday ? { color: theme.accent } : undefined}>
                      {String(dayOfMonth(d))}
                    </AppText>
                    {holiday ? (
                      <AppText
                        variant="caption"
                        numberOfLines={2}
                        style={{ color: theme.accent, fontWeight: '600', textAlign: 'center' }}>
                        {holiday.name}
                      </AppText>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {data.crew.map((c, rowIndex) => (
              <View
                key={c.id}
                onLayout={measure('right', c.id)}
                style={[
                  styles.row,
                  { minHeight: heights.left[c.id] },
                  rowIndex < data.crew.length - 1 && [styles.divider, { borderBottomColor: theme.border }],
                ]}>
                {shown.map((d) => {
                  const holiday = holidayOn(d);
                  const off = timeOffOn(data.timeOff, c.id, d);
                  const shifts = sortShifts(data.shifts.filter((s) => s.crew_id === c.id && s.shift_date === d));
                  const canAdd = isAdmin && !reordering;
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole={canAdd ? 'button' : undefined}
                      accessibilityLabel={
                        canAdd ? `Add shift for ${c.name} on ${shortWeekday(d)} ${dayOfMonth(d)}` : undefined
                      }
                      disabled={!canAdd}
                      onPress={() => router.push({ pathname: '/shift', params: { crew: c.id, date: d } })}
                      style={({ pressed }) => [
                        styles.dayCell,
                        styles.bodyCell,
                        { backgroundColor: pressed ? theme.primarySoft : holiday ? theme.surfaceMuted : undefined },
                      ]}>
                      {holiday && shifts.length === 0 && !off ? (
                        <AppText variant="caption" muted style={{ fontSize: 12, fontStyle: 'italic' }}>
                          Office closed
                        </AppText>
                      ) : null}
                      {off ? <TimeOffChip entry={off} /> : null}
                      {shifts.map((s) => (
                        <ShiftChip
                          key={s.id}
                          shift={s}
                          color={c.color}
                          conflicts={shiftConflicts(s, data.timeOff, data.holidays)}
                          onPress={
                            isAdmin && !reordering
                              ? () => router.push({ pathname: '/shift', params: { id: s.id } })
                              : undefined
                          }
                        />
                      ))}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <ErrorText>{reorder.error ? errorMessage(reorder.error) : null}</ErrorText>
      {isAdmin && !reordering ? (
        <AppText variant="caption" muted>
          Tap an empty spot to add a shift, or a shift to change it.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden' },
  nameColumn: { width: NAME_WIDTH, borderRightWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  nameCell: { padding: Spacing.sm, gap: Spacing.xs, justifyContent: 'center' },
  dayCell: { flex: 1, minWidth: DAY_MIN_WIDTH },
  headCell: { alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, gap: 0 },
  bodyCell: { padding: Spacing.xs, gap: Spacing.xs, minHeight: 56 },
});
