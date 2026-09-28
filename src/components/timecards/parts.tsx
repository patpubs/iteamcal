import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, Chip, ColorDot, Divider, ErrorText, IconButton, ListRow } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { PunchAction, Timecard } from '@/features/timecards';
import { useTheme } from '@/hooks/use-theme';
import { addDays, longDay, rangeLabel, shortDay, shortWeekday, weekStart } from '@/lib/dates';
import { formatTime, formatTimeRange, useTimeFormat } from '@/lib/time-format';
import { formatHours, punchState, totalHours } from '@/lib/timecards';

export function timesLabel(card: Timecard) {
  return card.end_time ? formatTimeRange(card.start_time, card.end_time) : `From ${formatTime(card.start_time)}`;
}

export function lunchLabel(card: Timecard) {
  if (!card.lunch_start) return null;
  return card.lunch_end
    ? `Lunch ${formatTimeRange(card.lunch_start, card.lunch_end)}`
    : `Lunch from ${formatTime(card.lunch_start)}`;
}

/** Monday–Sunday navigation with a jump back to this week. */
export function WeekNav({ days, now, onGo }: { days: string[]; now: string; onGo: (week: string) => void }) {
  const thisWeek = weekStart(now) === days[0];
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          label="Previous week"
          onPress={() => onGo(addDays(days[0], -7))}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="heading" accessibilityRole="header">
            {thisWeek ? 'This week' : rangeLabel(days[0], days[6])}
          </AppText>
          {thisWeek ? (
            <AppText variant="caption" muted>
              {rangeLabel(days[0], days[6])}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          label="Next week"
          onPress={() => onGo(addDays(days[0], 7))}
        />
      </View>
      {!thisWeek ? (
        <View style={{ alignItems: 'center', marginTop: -Spacing.sm }}>
          <Chip label="Back to this week" onPress={() => onGo(weekStart(now))} />
        </View>
      ) : null}
    </>
  );
}

/** Today's card with the one-tap punch buttons (PRD §9). No running counter. */
export function TodayCard({
  card,
  now,
  onPunch,
  busy,
  error,
}: {
  card: Timecard | undefined;
  now: string;
  onPunch: (action: PunchAction) => void;
  busy: boolean;
  error: string | null;
}) {
  const theme = useTheme();
  useTimeFormat();
  const state = punchState(card);
  const status = {
    none: 'Not clocked in',
    working: 'Clocked in',
    lunch: 'On lunch',
    done: 'Done for the day',
  }[state];
  const live = state === 'working' || state === 'lunch';
  return (
    <Card style={live ? { borderColor: theme.accent, backgroundColor: theme.accentSoft } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }}>
        <AppText variant="caption" muted>
          {`Today · ${longDay(now)}`}
        </AppText>
        {live ? <ColorDot color={theme.accent} size={10} /> : null}
      </View>
      <AppText variant="heading" style={live ? { color: theme.accent } : undefined}>
        {status}
      </AppText>
      {card ? (
        <View style={{ gap: 2 }}>
          <AppText>
            {state === 'done' ? timesLabel(card) : `Since ${formatTime(card.start_time)}`}
            {card.net_hours != null ? ` · ${formatHours(card.net_hours)}` : ''}
          </AppText>
          {lunchLabel(card) ? (
            <AppText variant="caption" muted>
              {lunchLabel(card)}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {state === 'none' ? <Button label="Clock in" onPress={() => onPunch('clock_in')} loading={busy} /> : null}
      {state === 'working' ? (
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {!card?.lunch_start ? (
            <View style={{ flex: 1 }}>
              <Button label="Start lunch" variant="secondary" onPress={() => onPunch('lunch_start')} disabled={busy} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label="Clock out" onPress={() => onPunch('clock_out')} loading={busy} />
          </View>
        </View>
      ) : null}
      {state === 'lunch' ? <Button label="End lunch" onPress={() => onPunch('lunch_end')} loading={busy} /> : null}
    </Card>
  );
}

/** One person's week, a row per day including missing ones. */
export function WeekList({
  days,
  cards,
  now,
  userId,
}: {
  days: string[];
  cards: Timecard[];
  now: string;
  userId: string;
}) {
  useTimeFormat();
  const byDay = new Map(cards.map((c) => [c.work_date, c]));
  return (
    <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
      {days.map((day, i) => {
        const card = byDay.get(day);
        const label = `${shortWeekday(day)} ${shortDay(day)}${day === now ? ' · Today' : ''}`;
        return (
          <View key={day}>
            {i > 0 ? <Divider /> : null}
            {card ? (
              <ListRow
                title={label}
                subtitle={[timesLabel(card), lunchLabel(card)].filter(Boolean).join(' · ')}
                trailing={
                  <AppText variant="label">{card.net_hours != null ? formatHours(card.net_hours) : 'Open'}</AppText>
                }
                onPress={() => router.push({ pathname: '/timecards/entry', params: { id: card.id } })}
              />
            ) : (
              <ListRow
                title={label}
                subtitle={day > now ? 'Upcoming' : 'No entry'}
                trailing={
                  day <= now ? (
                    <Chip
                      label="+ Add"
                      onPress={() => router.push({ pathname: '/timecards/entry', params: { user: userId, date: day } })}
                    />
                  ) : null
                }
              />
            )}
          </View>
        );
      })}
    </Card>
  );
}

export function WeekTotal({ cards }: { cards: Timecard[] }) {
  const open = cards.some((c) => c.end_time == null);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <AppText variant="label">Week total</AppText>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="heading">{formatHours(totalHours(cards))}</AppText>
        {open ? (
          <AppText variant="caption" muted>
            Open days count once they’re finished.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One person in the admin's crew week: their total and a cell per day.
 * Seven cells fit a 390px phone, so there's no sideways scrolling.
 */
export function CrewWeekCard({
  name,
  color,
  userId,
  days,
  cards,
  now,
}: {
  name: string;
  color?: string;
  userId: string;
  days: string[];
  cards: Timecard[];
  now: string;
}) {
  const theme = useTheme();
  const byDay = new Map(cards.map((c) => [c.work_date, c]));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        {color ? <ColorDot color={color} /> : null}
        <AppText variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="label">{formatHours(totalHours(cards))}</AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((day) => {
          const card = byDay.get(day);
          const future = day > now;
          const open = card && card.end_time == null;
          const text = card ? (card.net_hours != null ? card.net_hours.toFixed(2) : 'Open') : future ? '' : '—';
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${longDay(day)}: ${card ? text : 'no entry'}`}
              disabled={future && !card}
              onPress={() =>
                router.push({
                  pathname: '/timecards/entry',
                  params: card ? { id: card.id } : { user: userId, date: day },
                })
              }
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 6,
                borderRadius: Radius.sm,
                backgroundColor: open ? theme.accentSoft : card ? theme.primarySoft : theme.surfaceMuted,
                opacity: pressed ? 0.7 : future && !card ? 0.5 : 1,
              })}>
              <AppText variant="caption" muted>
                {shortWeekday(day).slice(0, 2)}
              </AppText>
              <AppText
                variant="caption"
                style={{
                  fontWeight: '600',
                  color: open ? theme.accent : card ? theme.primary : theme.textMuted,
                }}>
                {text || ' '}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
