import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Paper, PrintFrame, PrintText } from '@/components/print-frame';
import { AppText, Loading, Screen } from '@/components/ui';
import { useTimeOffEntries } from '@/features/time-off';
import { useCrew } from '@/features/team';
import {
  addDays,
  addMonths,
  isDay,
  monthGrid,
  monthLabel,
  monthStart,
  sameMonth,
  shortWeekday,
  today,
} from '@/lib/dates';
import { timeOffLabel, timeOffText } from '@/lib/schedule';
import { rangeText } from '@/lib/time-off';
import { useAuth } from '@/providers/auth';

type Layout = 'list' | 'calendar';

/** One month of recorded time off on paper, as a list or a calendar (PRD §12). */
export default function PrintTimeOffScreen() {
  const { isAdmin } = useAuth();
  const params = useLocalSearchParams<{ month?: string; layout?: string }>();
  const month = monthStart(params.month && isDay(params.month) ? params.month : today());
  const layout: Layout = params.layout === 'calendar' ? 'calendar' : 'list';
  const last = addDays(addMonths(month, 1), -1);
  const entries = useTimeOffEntries(month, last);
  const crew = useCrew();

  if (!isAdmin) {
    return (
      <Screen>
        <AppText muted>Only admins can print the team’s time off.</AppText>
      </Screen>
    );
  }

  const go = (next: { month?: string; layout?: Layout }) =>
    router.setParams({ month: next.month ?? month, layout: next.layout ?? layout });
  const crewById = new Map((crew.data ?? []).map((c) => [c.id, c]));
  const list = [...(entries.data ?? [])].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      (crewById.get(a.crew_id)?.name ?? '').localeCompare(crewById.get(b.crew_id)?.name ?? ''),
  );

  const toggle = (value: Layout, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: layout === value }}
      onPress={() => go({ layout: value })}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: layout === value ? Paper.primarySoft : Paper.surfaceMuted,
      }}>
      <Text style={{ fontWeight: '600', color: layout === value ? Paper.primary : Paper.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <PrintFrame
      title="Time off"
      subtitle={monthLabel(month)}
      onPrev={() => go({ month: addMonths(month, -1) })}
      onNext={() => go({ month: addMonths(month, 1) })}
      controls={
        <>
          {toggle('list', 'List')}
          {toggle('calendar', 'Calendar')}
        </>
      }
      fallback="/time-off">
      {entries.isPending || crew.isPending ? (
        <Loading />
      ) : !list.length ? (
        <PrintText muted>No one has time off in {monthLabel(month)}.</PrintText>
      ) : layout === 'list' ? (
        <View style={{ borderTopWidth: 0.5, borderColor: Paper.border }}>
          {list.map((t) => {
            const c = crewById.get(t.crew_id);
            return (
              <View
                key={t.id}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  paddingVertical: 6,
                  borderBottomWidth: 0.5,
                  borderColor: Paper.border,
                }}>
                <View style={{ width: 150, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c?.color ?? Paper.border }} />
                  <PrintText bold>{c?.name ?? 'Former crew member'}</PrintText>
                </View>
                <View style={{ width: 170 }}>
                  <PrintText>{rangeText(t)}</PrintText>
                </View>
                <View style={{ width: 90 }}>
                  <PrintText>{timeOffLabel(t.type)}</PrintText>
                </View>
                <View style={{ flex: 1 }}>
                  <PrintText muted>{t.reason ?? ''}</PrintText>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ borderWidth: 0.5, borderColor: Paper.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: Paper.surfaceMuted }}>
            {monthGrid(month)[0].map((d) => (
              <View key={d} style={{ flex: 1, padding: 4, borderWidth: 0.5, borderColor: Paper.border }}>
                <PrintText bold>{shortWeekday(d)}</PrintText>
              </View>
            ))}
          </View>
          {monthGrid(month).map((week) => (
            <View key={week[0]} style={{ flexDirection: 'row' }}>
              {week.map((d) => {
                const off = list.filter((t) => t.start_date <= d && t.end_date >= d);
                const inMonth = sameMonth(d, month);
                return (
                  <View
                    key={d}
                    style={{ flex: 1, minHeight: 64, padding: 4, gap: 2, borderWidth: 0.5, borderColor: Paper.border }}>
                    <PrintText muted={!inMonth} bold={inMonth}>
                      {String(Number(d.slice(8, 10)))}
                    </PrintText>
                    {inMonth
                      ? off.map((t) => {
                          const c = crewById.get(t.crew_id);
                          return (
                            <View
                              key={t.id}
                              style={{ borderLeftWidth: 3, borderLeftColor: c?.color ?? Paper.border, paddingLeft: 3 }}>
                              <PrintText size={10}>{`${c?.name ?? 'Former crew'} · ${timeOffText(t)}`}</PrintText>
                            </View>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </PrintFrame>
  );
}
