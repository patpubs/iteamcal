import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

import { NotificationBell } from '@/components/notification-bell';
import { DayAgenda } from '@/components/schedule/day-agenda';
import { ListView } from '@/components/schedule/list-view';
import { MonthView } from '@/components/schedule/month-view';
import { ReorderList } from '@/components/schedule/reorder-list';
import { SwipeDays } from '@/components/schedule/swipe-days';
import type { ScheduleData } from '@/components/schedule/types';
import { WeekStrip } from '@/components/schedule/week-strip';
import { WeekView } from '@/components/schedule/week-view';
import { AppText, Button, Chip, ErrorText, IconButton, Loading, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useScheduleRange, useScheduleRealtime } from '@/features/schedule';
import { useCrew } from '@/features/team';
import { errorMessage } from '@/lib/confirm';
import {
  addDays,
  addMonths,
  isDay,
  longDay,
  monthGrid,
  monthLabel,
  rangeLabel,
  today,
  weekDays,
  weekStart,
} from '@/lib/dates';
import { useAuth } from '@/providers/auth';

type View_ = 'day' | 'week' | 'month';
const VIEWS: { value: View_; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

// Below this width the week grid would need sideways scrolling, so the week
// becomes a day-by-day list and the schedule opens on a single day.
const WIDE = 760;

export default function ScheduleScreen() {
  const params = useLocalSearchParams<{ view?: string; date?: string }>();
  const wide = useWindowDimensions().width >= WIDE;
  const view: View_ =
    params.view === 'day' || params.view === 'week' || params.view === 'month' ? params.view : wide ? 'week' : 'day';
  const now = today();
  const date = params.date && isDay(params.date) ? params.date : now;
  const { isAdmin } = useAuth();
  const [reordering, setReordering] = useState(false);

  useScheduleRealtime();

  // Day and week load Monday–Sunday (the strip needs the whole week); month
  // loads every day in its grid.
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
    if (view === 'day') go({ date: addDays(date, dir) });
    else if (view === 'week') go({ date: addDays(weekStart(date), 7 * dir) });
    else go({ date: addMonths(date, dir) });
  }

  const unit = view === 'day' ? 'day' : view === 'week' ? 'week' : 'month';
  const heading = view === 'day' ? longDay(date) : view === 'week' ? rangeLabel(days[0], days[6]) : monthLabel(date);
  const showingToday =
    view === 'day' ? date === now : view === 'week' ? weekStart(date) === weekStart(now) : date === now;
  const gridReorder = reordering && wide && view === 'week';

  let body = null;
  if (!data) body = <Loading />;
  else if (reordering && !gridReorder) body = <ReorderList crew={data.crew} />;
  else if (view === 'day')
    body = (
      <SwipeDays onStep={step}>
        <DayAgenda data={data} day={date} isAdmin={isAdmin} />
      </SwipeDays>
    );
  else if (view === 'week')
    body = wide ? (
      <WeekView data={data} days={days} isAdmin={isAdmin} reordering={reordering} />
    ) : (
      <ListView data={data} days={days} isAdmin={isAdmin} onPickDay={(d) => go({ view: 'day', date: d })} />
    );
  else
    body = (
      <View style={{ gap: Spacing.lg }}>
        <MonthView
          data={data}
          weeks={grid}
          month={date}
          selected={date}
          compact={!wide}
          onPickDay={(d) => go({ date: d })}
        />
        <View style={{ gap: Spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            {date === now ? `Today · ${longDay(date)}` : longDay(date)}
          </AppText>
          <DayAgenda data={data} day={date} isAdmin={isAdmin} />
        </View>
      </View>
    );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">Schedule</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          {isAdmin ? (
            <Chip
              label={reordering ? 'Done' : 'Reorder crew'}
              selected={reordering}
              onPress={() => setReordering((r) => !r)}
            />
          ) : null}
          <NotificationBell />
        </View>
      </View>

      {!reordering || gridReorder ? (
        <>
          <Segmented options={VIEWS} value={view} onChange={(v) => go({ view: v })} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <IconButton
              icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              label={`Previous ${unit}`}
              onPress={() => step(-1)}
            />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="heading" style={{ textAlign: 'center' }} accessibilityRole="header">
                {heading}
              </AppText>
            </View>
            <IconButton
              icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              label={`Next ${unit}`}
              onPress={() => step(1)}
            />
          </View>
          {!showingToday ? (
            <View style={{ alignItems: 'center', marginTop: -Spacing.sm }}>
              <Chip label="Back to today" onPress={() => go({ date: now })} />
            </View>
          ) : null}

          {view === 'day' && data ? (
            <WeekStrip data={data} days={days} selected={date} onSelect={(d) => go({ date: d })} />
          ) : null}
        </>
      ) : null}

      <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      {body}

      {Platform.OS === 'web' && !reordering ? (
        <Button
          label="Print this week"
          variant="secondary"
          onPress={() => router.push({ pathname: '/print-week', params: { date: days[0] } })}
        />
      ) : null}
      {isAdmin && !reordering ? (
        <>
          <Button
            label="Add shift"
            onPress={() =>
              router.push({
                pathname: '/shift',
                params: { date: view === 'week' ? (days.includes(now) ? now : days[0]) : date },
              })
            }
          />
          {view === 'week' ? (
            <Button
              label="Copy this week"
              variant="secondary"
              onPress={() => router.push({ pathname: '/copy-week', params: { from: days[0] } })}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
