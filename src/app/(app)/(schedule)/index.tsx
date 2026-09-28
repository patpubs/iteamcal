import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MonthView } from '@/components/schedule/month-view';
import { ListView } from '@/components/schedule/list-view';
import { WeekView } from '@/components/schedule/week-view';
import type { ScheduleData } from '@/components/schedule/types';
import { AppText, Button, Chip, ErrorText, IconButton, Loading, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useScheduleRange, useScheduleRealtime } from '@/features/schedule';
import { useCrew } from '@/features/team';
import { errorMessage } from '@/lib/confirm';
import { addDays, addMonths, isDay, monthGrid, monthLabel, rangeLabel, today, weekDays, weekStart } from '@/lib/dates';
import { useAuth } from '@/providers/auth';

type View_ = 'week' | 'month' | 'list';
const VIEWS: { value: View_; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'list', label: 'List' },
];

export default function ScheduleScreen() {
  const params = useLocalSearchParams<{ view?: string; date?: string }>();
  const view: View_ = params.view === 'month' || params.view === 'list' ? params.view : 'week';
  const now = today();
  const date = params.date && isDay(params.date) ? params.date : now;
  const { isAdmin } = useAuth();
  const [reordering, setReordering] = useState(false);

  useScheduleRealtime();

  // Week and list cover Monday–Sunday; month covers every day in its grid.
  const grid = useMemo(() => monthGrid(date), [date]);
  const days = useMemo(() => weekDays(date), [date]);
  const from = view === 'month' ? grid[0][0] : days[0];
  const to = view === 'month' ? grid.at(-1)![6] : days[6];

  const crew = useCrew();
  const { shifts, timeOff, holidays } = useScheduleRange(from, to);

  const data: ScheduleData | null = useMemo(() => {
    if (!crew.data || !shifts.data || !timeOff.data || !holidays.data) return null;
    // Full-time crew aren't on the variable schedule (PRD §4).
    const shown = crew.data.filter((c) => !c.archived_at && !c.full_time);
    const ids = new Set(shown.map((c) => c.id));
    return {
      crew: shown,
      crewById: new Map(shown.map((c) => [c.id, c])),
      shifts: shifts.data.filter((s) => ids.has(s.crew_id)),
      timeOff: timeOff.data.filter((t) => ids.has(t.crew_id)),
      holidays: holidays.data,
      today: now,
    };
  }, [crew.data, shifts.data, timeOff.data, holidays.data, now]);

  const error = crew.error ?? shifts.error ?? timeOff.error ?? holidays.error;

  function go(next: { view?: View_; date?: string }) {
    router.setParams({ view: next.view ?? view, date: next.date ?? date });
  }
  function step(dir: -1 | 1) {
    go({ date: view === 'month' ? addMonths(date, dir) : addDays(weekStart(date), 7 * dir) });
  }

  const inCurrentPeriod = view === 'month' ? date.slice(0, 7) === now.slice(0, 7) : weekStart(date) === weekStart(now);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">Schedule</AppText>
        {isAdmin && view === 'week' ? (
          <Chip
            label={reordering ? 'Done' : 'Reorder crew'}
            selected={reordering}
            onPress={() => setReordering((r) => !r)}
          />
        ) : null}
      </View>

      <Segmented options={VIEWS} value={view} onChange={(v) => go({ view: v })} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          label={view === 'month' ? 'Previous month' : 'Previous week'}
          onPress={() => step(-1)}
        />
        <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }} accessibilityRole="header">
          {view === 'month' ? monthLabel(date) : rangeLabel(days[0], days[6])}
        </AppText>
        <IconButton
          icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          label={view === 'month' ? 'Next month' : 'Next week'}
          onPress={() => step(1)}
        />
      </View>
      {!inCurrentPeriod ? (
        <View style={{ alignItems: 'center', marginTop: -Spacing.sm }}>
          <Chip label="Back to today" onPress={() => go({ date: now })} />
        </View>
      ) : null}

      <ErrorText>{error ? errorMessage(error) : null}</ErrorText>

      {!data ? (
        <Loading />
      ) : view === 'week' ? (
        <WeekView data={data} days={days} isAdmin={isAdmin} reordering={reordering} />
      ) : view === 'month' ? (
        <MonthView data={data} weeks={grid} month={date} onPickDay={(d) => go({ view: 'week', date: d })} />
      ) : (
        <ListView data={data} days={days} isAdmin={isAdmin} />
      )}

      {isAdmin && !reordering ? (
        <Button
          label="Add shift"
          onPress={() => router.push({ pathname: '/shift', params: { date: days.includes(now) ? now : days[0] } })}
        />
      ) : null}
    </Screen>
  );
}
