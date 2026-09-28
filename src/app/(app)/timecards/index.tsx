import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CrewWeekCard, TodayCard, WeekList, WeekNav, WeekTotal } from '@/components/timecards/parts';
import { AppText, Card, Columns, ErrorText, Loading, PageHeader, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { displayName, useCrew, useProfiles } from '@/features/team';
import {
  type PunchAction,
  usePunch,
  useTimecards,
  useTimecardsHidden,
  useTimecardsRealtime,
} from '@/features/timecards';
import { useIsDesktop } from '@/hooks/use-layout';
import { errorMessage } from '@/lib/confirm';
import { isDay, today, weekDays } from '@/lib/dates';
import { formatHours, totalHours } from '@/lib/timecards';
import { useAuth } from '@/providers/auth';

type Tab = 'mine' | 'crew';
const TABS: { value: Tab; label: string }[] = [
  { value: 'mine', label: 'My timecard' },
  { value: 'crew', label: 'Crew' },
];

export default function TimecardsScreen() {
  const params = useLocalSearchParams<{ week?: string; tab?: string }>();
  const { isAdmin } = useAuth();
  const hidden = useTimecardsHidden();
  const desktop = useIsDesktop();
  const now = today();
  const days = useMemo(() => weekDays(params.week && isDay(params.week) ? params.week : now), [params.week, now]);

  useTimecardsRealtime();

  if (hidden === undefined) return <Loading />;

  // Admins who don't keep a card themselves still manage everyone else's.
  const tab: Tab = isAdmin && (hidden || params.tab === 'crew') ? 'crew' : 'mine';
  const go = (next: { week?: string; tab?: Tab }) =>
    router.setParams({ week: next.week ?? days[0], tab: next.tab ?? tab });

  if (hidden && !isAdmin) {
    return (
      <Screen>
        <AppText variant="title">Timecards</AppText>
        <Card>
          <AppText variant="label">No timecards needed</AppText>
          <AppText muted>You’re set up to not keep a timecard. If that’s wrong, ask an admin to change it.</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Timecards">
        {isAdmin && !hidden && desktop ? (
          <View style={{ width: 280 }}>
            <Segmented options={TABS} value={tab} onChange={(t) => go({ tab: t })} />
          </View>
        ) : null}
      </PageHeader>
      {isAdmin && !hidden && !desktop ? (
        <Segmented options={TABS} value={tab} onChange={(t) => go({ tab: t })} />
      ) : null}
      {tab === 'crew' ? (
        <CrewWeek days={days} now={now} onWeek={(w) => go({ week: w })} />
      ) : (
        <MyWeek days={days} now={now} onWeek={(w) => go({ week: w })} />
      )}
    </Screen>
  );
}

function MyWeek({ days, now, onWeek }: { days: string[]; now: string; onWeek: (week: string) => void }) {
  const { profile } = useAuth();
  const userId = profile!.id;
  const week = useTimecards(days[0], days[6], userId);
  const todays = useTimecards(now, now, userId);
  const punch = usePunch();
  const [error, setError] = useState<string | null>(null);

  async function onPunch(action: PunchAction) {
    setError(null);
    try {
      await punch.mutateAsync(action);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // Desktop: today's punch card on the left, the week beside it.
  return (
    <Columns
      sideFirst
      side={
        todays.isPending ? (
          <Loading />
        ) : (
          <TodayCard card={todays.data?.[0]} now={now} onPunch={onPunch} busy={punch.isPending} error={error} />
        )
      }
      main={
        <>
          <WeekNav days={days} now={now} onGo={onWeek} />
          <ErrorText>{week.error ? errorMessage(week.error) : null}</ErrorText>
          {week.data ? (
            <>
              <WeekList days={days} cards={week.data} now={now} userId={userId} />
              <WeekTotal cards={week.data} />
            </>
          ) : (
            <Loading />
          )}
        </>
      }
    />
  );
}

/**
 * Admin view of everyone's week (PRD §10): approved accounts, including
 * people with no entries, minus crew set to not need timecards. Sorted by
 * name rather than schedule order.
 */
function CrewWeek({ days, now, onWeek }: { days: string[]; now: string; onWeek: (week: string) => void }) {
  const profiles = useProfiles();
  const crew = useCrew();
  const cards = useTimecards(days[0], days[6]);
  const desktop = useIsDesktop();

  const people = useMemo(() => {
    if (!profiles.data || !crew.data) return null;
    const crewById = new Map(crew.data.map((c) => [c.id, c]));
    return profiles.data
      .filter((p) => p.approval === 'approved' && !(p.crew_id && crewById.get(p.crew_id)?.hide_timecards))
      .map((p) => ({
        id: p.id,
        name: displayName(p, crew.data),
        color: p.crew_id ? crewById.get(p.crew_id)?.color : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles.data, crew.data]);

  const error = profiles.error ?? crew.error ?? cards.error;
  const shown = new Set(people?.map((p) => p.id));
  const shownCards = (cards.data ?? []).filter((c) => shown.has(c.user_id));

  return (
    <>
      <WeekNav days={days} now={now} onGo={onWeek} />
      <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      {!people || !cards.data ? (
        <Loading />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText variant="label">Crew total</AppText>
              <AppText variant="heading">{formatHours(totalHours(shownCards))}</AppText>
            </View>
            <AppText variant="caption" muted>
              Tap a day to add or fix a card. Open days count once they’re finished.
            </AppText>
          </Card>
          {people.length ? (
            <View
              style={{
                gap: Spacing.md,
                flexDirection: desktop ? 'row' : 'column',
                flexWrap: desktop ? 'wrap' : 'nowrap',
              }}>
              {people.map((p) => (
                <View key={p.id} style={desktop ? { width: '48.5%' } : undefined}>
                  <CrewWeekCard
                    key={p.id}
                    name={p.name}
                    color={p.color}
                    userId={p.id}
                    days={days}
                    cards={shownCards.filter((c) => c.user_id === p.id)}
                    now={now}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Card>
              <AppText muted>No one keeps a timecard yet. People show up here once they sign in.</AppText>
            </Card>
          )}
        </>
      )}
    </>
  );
}
