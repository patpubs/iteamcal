import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Loading } from '@/components/ui';
import { Paper, PrintFrame, PrintText } from '@/components/print-frame';
import { useScheduleRange } from '@/features/schedule';
import { useCrew } from '@/features/team';
import { addDays, isDay, rangeLabel, shortDay, shortWeekday, today, weekDays } from '@/lib/dates';
import { shiftTimeLabel, sortShifts, timeOffLabel, timeOffOn, visibleWeekDays } from '@/lib/schedule';
import { useTimeFormat } from '@/lib/time-format';

/**
 * The week's schedule on paper (PRD §12): schedule crew in their saved order,
 * Monday–Friday plus any weekend day with work or time off, holidays marked.
 */
export default function PrintWeekScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const week = useMemo(() => weekDays(params.date && isDay(params.date) ? params.date : today()), [params.date]);
  useTimeFormat();
  const crew = useCrew();
  const { shifts, timeOff, holidays } = useScheduleRange(week[0], week[6]);

  const go = (date: string) => router.setParams({ date });
  const frame = (children: React.ReactNode) => (
    <PrintFrame
      title="Schedule"
      subtitle={rangeLabel(week[0], week[6])}
      onPrev={() => go(addDays(week[0], -7))}
      onNext={() => go(addDays(week[0], 7))}
      fallback="/">
      {children}
    </PrintFrame>
  );

  if (!crew.data || !shifts.data || !timeOff.data || !holidays.data) return frame(<Loading />);

  const people = crew.data.filter((c) => !c.archived_at && !c.full_time);
  const ids = new Set(people.map((c) => c.id));
  const weekShifts = sortShifts(shifts.data.filter((s) => ids.has(s.crew_id)));
  const weekOff = timeOff.data.filter((t) => ids.has(t.crew_id));
  const days = visibleWeekDays(week, { shifts: weekShifts, timeOff: weekOff, holidays: holidays.data });
  const border = { borderColor: Paper.border, borderWidth: 0.5 };
  const NAME_WIDTH = 130;

  return frame(
    <View style={{ borderColor: Paper.border, borderWidth: 0.5 }}>
      <View style={{ flexDirection: 'row', backgroundColor: Paper.surfaceMuted }}>
        <View style={[border, { width: NAME_WIDTH, padding: 6 }]}>
          <PrintText bold>Crew</PrintText>
        </View>
        {days.map((d) => {
          const holiday = holidays.data.find((h) => h.holiday_date === d);
          return (
            <View key={d} style={[border, { flex: 1, padding: 6 }]}>
              <PrintText bold>{`${shortWeekday(d)} ${shortDay(d)}`}</PrintText>
              {holiday ? <PrintText muted size={10}>{`${holiday.name} · office closed`}</PrintText> : null}
            </View>
          );
        })}
      </View>
      {people.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row' }}>
          <View style={[border, { width: NAME_WIDTH, padding: 6, flexDirection: 'row', gap: 6 }]}>
            <View style={{ width: 4, borderRadius: 2, backgroundColor: c.color }} />
            <PrintText bold>{c.name}</PrintText>
          </View>
          {days.map((d) => {
            const dayShifts = weekShifts.filter((s) => s.crew_id === c.id && s.shift_date === d);
            const off = timeOffOn(weekOff, c.id, d);
            return (
              <View key={d} style={[border, { flex: 1, padding: 6, gap: 4 }]}>
                {off ? (
                  <View style={{ backgroundColor: Paper.accentSoft, borderRadius: 4, paddingHorizontal: 4 }}>
                    <PrintText size={11}>{timeOffLabel(off.type)}</PrintText>
                  </View>
                ) : null}
                {dayShifts.map((s) => (
                  <View key={s.id} style={{ borderLeftWidth: 3, borderLeftColor: c.color, paddingLeft: 4 }}>
                    <PrintText size={11}>{shiftTimeLabel(s)}</PrintText>
                    {s.notes ? (
                      <PrintText muted size={10}>
                        {s.notes}
                      </PrintText>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </View>,
  );
}
