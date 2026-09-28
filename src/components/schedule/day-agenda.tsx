import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Card, ColorDot, SectionTitle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shiftConflicts, sortShifts, timeOffOn } from '@/lib/schedule';

import { ShiftChip, TimeOffChip } from './parts';
import type { ScheduleData } from './types';

/** One day, top to bottom: closure, who's working, who's off, who's free. */
export function DayAgenda({ data, day, isAdmin }: { data: ScheduleData; day: string; isAdmin: boolean }) {
  const theme = useTheme();
  const holiday = data.holidays.find((h) => h.holiday_date === day);
  const working = data.crew
    .map((c) => ({
      crew: c,
      shifts: sortShifts(data.shifts.filter((s) => s.crew_id === c.id && s.shift_date === day)),
    }))
    .filter((x) => x.shifts.length);
  // Earliest start first, like a day's run sheet; untimed shifts last.
  working.sort((a, b) => {
    const as = a.shifts[0].start_time;
    const bs = b.shifts[0].start_time;
    if (as && bs) return as.localeCompare(bs);
    return as ? -1 : bs ? 1 : 0;
  });
  const off = data.crew.map((c) => ({ crew: c, entry: timeOffOn(data.timeOff, c.id, day) })).filter((x) => x.entry);
  const busy = new Set([...working.map((w) => w.crew.id), ...off.map((o) => o.crew.id)]);
  const free = data.crew.filter((c) => !busy.has(c.id));

  if (data.crew.length === 0) {
    return (
      <AppText muted>
        {isAdmin ? 'Add crew on More → Crew to start the schedule.' : 'No one is on the schedule yet.'}
      </AppText>
    );
  }

  return (
    <View style={{ gap: Spacing.md }}>
      {holiday ? (
        <View style={{ backgroundColor: theme.accentSoft, borderRadius: Radius.md, padding: Spacing.md, gap: 2 }}>
          <AppText variant="label" style={{ color: theme.accent }}>
            {holiday.name}
          </AppText>
          <AppText variant="caption" style={{ color: theme.accent }}>
            Office closed
          </AppText>
        </View>
      ) : null}

      <SectionTitle>{`Working (${working.length})`}</SectionTitle>
      {working.length ? (
        <View style={{ gap: Spacing.sm }}>
          {working.flatMap(({ crew, shifts }) =>
            shifts.map((s) => (
              <ShiftChip
                key={s.id}
                shift={s}
                title={crew.name}
                color={crew.color}
                size="large"
                conflicts={shiftConflicts(s, data.timeOff, data.holidays)}
                onPress={isAdmin ? () => router.push({ pathname: '/shift', params: { id: s.id } }) : undefined}
              />
            )),
          )}
        </View>
      ) : (
        <Card>
          <AppText muted>{holiday ? 'No one is scheduled. The office is closed.' : 'No one is scheduled.'}</AppText>
        </Card>
      )}

      {off.length ? (
        <>
          <SectionTitle>{`Off (${off.length})`}</SectionTitle>
          <View style={{ gap: Spacing.sm }}>
            {off.map(({ crew, entry }) => (
              <TimeOffChip key={crew.id} entry={entry!} title={crew.name} />
            ))}
          </View>
        </>
      ) : null}

      {free.length ? (
        <>
          <SectionTitle>{`Not scheduled (${free.length})`}</SectionTitle>
          <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
            {free.map((c) => (
              <Pressable
                key={c.id}
                disabled={!isAdmin}
                accessibilityRole={isAdmin ? 'button' : undefined}
                accessibilityLabel={isAdmin ? `Add shift for ${c.name}` : c.name}
                onPress={() => router.push({ pathname: '/shift', params: { crew: c.id, date: day } })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.sm,
                  paddingVertical: Spacing.sm,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <ColorDot color={c.color} size={10} />
                <AppText style={{ flex: 1 }}>{c.name}</AppText>
                {isAdmin ? (
                  <AppText variant="label" style={{ color: theme.primary }}>
                    + Add
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}
