import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Icon,
  IconButton,
  Loading,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { DatePicker } from '@/components/date-picker';
import { TimePair } from '@/components/time-picker';
import {
  type Shift,
  useDeleteShift,
  useMoveShift,
  useSaveShift,
  useScheduleRange,
  useShift,
} from '@/features/schedule';
import { type Crew, useCrew } from '@/features/team';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage, goBack } from '@/lib/confirm';
import { addDays, isDay, longDay, shortDay, shortWeekday, today } from '@/lib/dates';
import {
  endBeforeStartMessage,
  parseTime,
  shiftConflicts,
  shiftTimeLabel,
  unusualSentence,
  unusualTimes,
} from '@/lib/schedule';
import { formatTime } from '@/lib/time-format';

export default function ShiftScreen() {
  const params = useLocalSearchParams<{ id?: string; crew?: string; date?: string }>();
  const crew = useCrew();
  const shift = useShift(params.id);

  if (crew.isPending || (params.id && shift.isPending)) return <Loading />;
  if (params.id && !shift.data) {
    return (
      <Screen underHeader>
        <AppText muted>This shift was deleted.</AppText>
      </Screen>
    );
  }
  // Full-time and archived crew aren't on the schedule, but a shift that
  // already belongs to one stays editable.
  const choices = (crew.data ?? []).filter((c) => (!c.archived_at && !c.full_time) || c.id === shift.data?.crew_id);
  return (
    <ShiftForm
      key={shift.data?.id ?? 'new'}
      existing={shift.data ?? undefined}
      crew={choices}
      initialCrew={params.crew}
      initialDate={params.date && isDay(params.date) ? params.date : today()}
    />
  );
}

function ShiftForm({
  existing,
  crew,
  initialCrew,
  initialDate,
}: {
  existing?: Shift;
  crew: Crew[];
  initialCrew?: string;
  initialDate: string;
}) {
  const theme = useTheme();
  const save = useSaveShift();
  const remove = useDeleteShift();
  const move = useMoveShift();

  const [crewId, setCrewId] = useState(existing?.crew_id ?? initialCrew ?? '');
  const [date, setDate] = useState(existing?.shift_date ?? initialDate);
  const [start, setStart] = useState(existing?.start_time ? formatTime(existing.start_time) : '');
  const [end, setEnd] = useState(existing?.end_time ? formatTime(existing.end_time) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [askMove, setAskMove] = useState(false);

  const validDate = isDay(date);
  const around = useScheduleRange(validDate ? date : initialDate, validDate ? date : initialDate);
  const conflicts =
    validDate && crewId && around.timeOff.data && around.holidays.data
      ? shiftConflicts(
          { id: existing?.id ?? 'new', crew_id: crewId, shift_date: date, start_time: null, end_time: null },
          around.timeOff.data,
          around.holidays.data,
        )
      : [];
  const busy = save.isPending || remove.isPending || move.isPending;

  // Changing the day of an existing shift for the same person is a move: it
  // can't land on their time off, and their other shifts that day are merged
  // or replaced (PRD §5).
  const moving = !!existing && validDate && date !== existing.shift_date && crewId === existing.crew_id;
  const destShifts = moving
    ? (around.shifts.data ?? []).filter((s) => s.crew_id === crewId && s.shift_date === date && s.id !== existing!.id)
    : [];
  const movingOntoTimeOff = moving && conflicts.some((c) => c.kind === 'time-off');

  function validate() {
    const next: Record<string, string | null> = {};
    const startTime = parseTime(start);
    const endTime = parseTime(end);
    if (!crewId) next.crew = 'Choose who is working.';
    if (!validDate) next.date = 'Pick a day.';
    if (startTime === undefined) next.start = 'Try a time like 8:00 AM or 14:30.';
    if (endTime === undefined) next.end = 'Try a time like 4:30 PM or 16:30.';
    if (startTime && endTime && endTime <= startTime) next.end = endBeforeStartMessage(startTime, endTime);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return null;
    return {
      crew_id: crewId,
      shift_date: date,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      notes: notes.trim() || null,
    };
  }

  async function onSave() {
    const values = validate();
    if (!values) return;
    if (movingOntoTimeOff) return;
    const odd = unusualTimes(values.start_time, values.end_time);
    if (odd.length && !(await confirmAction('Double-check the times', unusualSentence('This shift', odd), 'Save')))
      return;
    if (moving && destShifts.length && !askMove) {
      setAskMove(true);
      return;
    }
    await finish(values, 'merge');
  }

  async function finish(values: NonNullable<ReturnType<typeof validate>>, mode: 'merge' | 'replace') {
    setError(null);
    setAskMove(false);
    try {
      if (moving) {
        await move.mutateAsync({ shift: existing!, to: date, expectedDest: destShifts.map((s) => s.id), mode });
      }
      await save.mutateAsync({ id: existing?.id, values });
      goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!existing) return;
    const name = crew.find((c) => c.id === existing.crew_id)?.name ?? 'this person';
    const ok = await confirmAction(`Delete this shift?`, `${name} on ${longDay(existing.shift_date)}.`, 'Delete');
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: existing ? 'Edit shift' : 'Add shift' }} />

      <SectionTitle>Who</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {crew.map((c) => (
          <Chip key={c.id} label={c.name} color={c.color} selected={c.id === crewId} onPress={() => setCrewId(c.id)} />
        ))}
      </View>
      <ErrorText>{errors.crew}</ErrorText>

      <SectionTitle>When</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          <IconButton
            icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            label="Day before"
            onPress={() => setDate(addDays(date, -1))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${longDay(date)}. ${picking ? 'Close the calendar' : 'Pick a day from the calendar'}`}
            onPress={() => setPicking((p) => !p)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Spacing.sm,
              height: 40,
              paddingHorizontal: Spacing.md,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: picking ? theme.primary : theme.border,
              backgroundColor: picking ? theme.primarySoft : theme.surface,
              opacity: pressed ? 0.75 : 1,
            })}>
            <Icon name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={18} />
            <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {`${shortWeekday(date)}, ${shortDay(date)}`}
            </AppText>
          </Pressable>
          <IconButton
            icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            label="Day after"
            onPress={() => setDate(addDays(date, 1))}
          />
        </View>
        {picking ? (
          <DatePicker
            selected={[date]}
            onPress={(d) => {
              setDate(d);
              setPicking(false);
            }}
          />
        ) : null}
        <ErrorText>{errors.date}</ErrorText>
        <TimePair
          first={{ label: 'Start', value: start, onChange: setStart, example: '08:00', error: errors.start }}
          second={{ label: 'End', value: end, onChange: setEnd, example: '16:30', error: errors.end }}
        />
        <AppText variant="caption" muted>
          Times are optional. Leave them blank if the hours aren’t set yet.
        </AppText>
      </Card>

      {conflicts.length ? (
        <Card style={{ backgroundColor: theme.dangerSoft, borderColor: theme.dangerSoft }}>
          {conflicts.map((c) => (
            <AppText key={c.kind} variant="label" style={{ color: theme.danger }}>
              {`⚠ ${c.label}`}
            </AppText>
          ))}
          <AppText variant="caption" style={{ color: theme.danger }}>
            {movingOntoTimeOff
              ? 'A shift can’t be moved onto a day off. Pick another day, or change the time off first.'
              : 'You can still save it. The shift will show as a conflict until it’s resolved.'}
          </AppText>
        </Card>
      ) : null}

      <Card>
        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Open the shop"
          multiline
        />
      </Card>

      <ErrorText>{error}</ErrorText>
      {askMove ? (
        <Card style={{ borderColor: theme.accent }}>
          <AppText variant="label">{`${crew.find((c) => c.id === crewId)?.name ?? 'They'} is already working ${longDay(date)}`}</AppText>
          <AppText muted>
            {destShifts.map((s) => shiftTimeLabel(s)).join(', ')}. Keep that shift too, or replace it with this one?
          </AppText>
          <Button
            label="Keep both"
            onPress={() => {
              const v = validate();
              if (v) finish(v, 'merge');
            }}
            disabled={busy}
          />
          <Button
            label="Replace it"
            variant="danger"
            onPress={() => {
              const v = validate();
              if (v) finish(v, 'replace');
            }}
            disabled={busy}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setAskMove(false)} disabled={busy} />
        </Card>
      ) : (
        <Button
          label={existing ? (moving ? 'Move shift' : 'Save changes') : 'Add shift'}
          onPress={onSave}
          loading={save.isPending || move.isPending}
          disabled={busy || movingOntoTimeOff}
        />
      )}
      {existing && !askMove ? (
        <>
          <Button
            label="Copy to other days"
            variant="secondary"
            onPress={() => router.push({ pathname: '/shift-copy', params: { id: existing.id } })}
            disabled={busy}
          />
          <Button label="Delete shift" variant="danger" onPress={onDelete} disabled={busy} />
        </>
      ) : null}
    </Screen>
  );
}
