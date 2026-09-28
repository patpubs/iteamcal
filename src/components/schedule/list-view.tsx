import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Badge, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { longDay } from '@/lib/dates';
import { shiftConflicts, sortShifts, timeOffOn } from '@/lib/schedule';

import { ShiftChip, TimeOffChip } from './parts';
import type { ScheduleData } from './types';

/** The week as a day-by-day list. Days with nothing on them are skipped. */
export function ListView({ data, days, isAdmin }: { data: ScheduleData; days: string[]; isAdmin: boolean }) {
  const theme = useTheme();

  const groups = days
    .map((d) => {
      const holiday = data.holidays.find((h) => h.holiday_date === d);
      const shifts = data.shifts.filter((s) => s.shift_date === d);
      // Crew order first, then time within each person.
      const ordered = data.crew.flatMap((c) => sortShifts(shifts.filter((s) => s.crew_id === c.id)));
      const off = data.crew.map((c) => ({ crew: c, entry: timeOffOn(data.timeOff, c.id, d) })).filter((x) => x.entry);
      return { day: d, holiday, shifts: ordered, off };
    })
    .filter((g) => g.holiday || g.shifts.length || g.off.length);

  if (groups.length === 0) {
    return (
      <Card>
        <AppText muted>Nothing is scheduled this week.</AppText>
      </Card>
    );
  }

  return (
    <View style={{ gap: Spacing.lg }}>
      {groups.map((g) => (
        <View key={g.day} style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
            <AppText
              variant="label"
              accessibilityRole="header"
              style={g.day === data.today ? { color: theme.accent } : undefined}>
              {g.day === data.today ? `Today · ${longDay(g.day)}` : longDay(g.day)}
            </AppText>
            {g.holiday ? <Badge label={`${g.holiday.name} · Office closed`} tone="accent" /> : null}
          </View>
          <Card style={{ gap: Spacing.sm }}>
            {g.shifts.length === 0 && g.off.length === 0 ? <AppText muted>No one is scheduled.</AppText> : null}
            {g.shifts.map((s) => {
              const c = data.crewById.get(s.crew_id)!;
              return (
                <ShiftChip
                  key={s.id}
                  shift={s}
                  title={c.name}
                  color={c.color}
                  conflicts={shiftConflicts(s, data.timeOff, data.holidays)}
                  onPress={isAdmin ? () => router.push({ pathname: '/shift', params: { id: s.id } }) : undefined}
                />
              );
            })}
            {g.off.map(({ crew, entry }) => (
              <TimeOffChip key={crew.id} entry={entry!} title={crew.name} />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}
