import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DatePicker } from '@/components/date-picker';
import { AppText, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { useDuplicateShift, useScheduleRange, useShift } from '@/features/schedule';
import { useCrew } from '@/features/team';
import { errorMessage, goBack } from '@/lib/confirm';
import { addMonths, longDay, monthGrid, shortDay } from '@/lib/dates';
import { shiftTimeLabel, timeOffDuring } from '@/lib/schedule';

/** Copies one shift onto days picked on a calendar (PRD §5). */
export default function ShiftCopyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shift = useShift(id);
  const crew = useCrew();
  const duplicate = useDuplicateShift();
  const [month, setMonth] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const shownMonth = month ?? shift.data?.shift_date ?? '2000-01-01';
  const grid = monthGrid(shownMonth);
  // Load a month either side so days off are known wherever the picker goes.
  const range = useScheduleRange(monthGrid(addMonths(shownMonth, -1))[0][0], grid.at(-1)![6]);

  if (shift.isPending || crew.isPending) return <Loading />;
  if (!shift.data) {
    return (
      <Screen underHeader>
        <AppText muted>This shift was deleted.</AppText>
      </Screen>
    );
  }
  const src = shift.data;
  const person = crew.data?.find((c) => c.id === src.crew_id);
  const timeOff = range.timeOff.data ?? [];

  function reason(day: string) {
    if (day === src.shift_date) return 'the original shift';
    if (timeOffDuring(timeOff, { ...src, shift_date: day })) return 'day off';
    return null;
  }

  async function onCopy() {
    setError(null);
    try {
      await duplicate.mutateAsync({ id: src.id, dates: picked });
      goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const sorted = [...picked].sort();

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: 'Copy to other days' }} />
      <Card>
        <AppText variant="label">{person?.name ?? 'Shift'}</AppText>
        <AppText muted>{`${shiftTimeLabel(src)} · from ${longDay(src.shift_date)}`}</AppText>
        {src.notes ? <AppText muted>{src.notes}</AppText> : null}
      </Card>
      <Card>
        <DatePicker
          initialMonth={src.shift_date}
          selected={picked}
          onMonthChange={setMonth}
          disabledReason={reason}
          onPress={(d) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}
        />
        <AppText variant="caption" muted>
          Tap the days to copy onto. Crossed-out days are days off. Each copy is its own shift, so changing this one
          later won’t change the copies.
        </AppText>
      </Card>
      {sorted.length ? <AppText muted>{sorted.map(shortDay).join(', ')}</AppText> : null}
      <ErrorText>{error}</ErrorText>
      <Button
        label={picked.length ? `Copy to ${picked.length} day${picked.length === 1 ? '' : 's'}` : 'Pick days to copy to'}
        onPress={onCopy}
        loading={duplicate.isPending}
        disabled={!picked.length}
      />
    </Screen>
  );
}
