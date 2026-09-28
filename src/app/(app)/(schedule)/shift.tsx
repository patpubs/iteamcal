import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  IconButton,
  Loading,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { type Shift, useDeleteShift, useSaveShift, useScheduleRange, useShift } from '@/features/schedule';
import { type Crew, useCrew } from '@/features/team';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage } from '@/lib/confirm';
import { addDays, isDay, longDay, today } from '@/lib/dates';
import { parseTime, shiftConflicts, shortTime } from '@/lib/schedule';

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

  const [crewId, setCrewId] = useState(existing?.crew_id ?? initialCrew ?? '');
  const [date, setDate] = useState(existing?.shift_date ?? initialDate);
  const [start, setStart] = useState(existing?.start_time ? shortTime(existing.start_time) : '');
  const [end, setEnd] = useState(existing?.end_time ? shortTime(existing.end_time) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

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
  const busy = save.isPending || remove.isPending;

  async function onSave() {
    const next: Record<string, string | null> = {};
    const startTime = parseTime(start);
    const endTime = parseTime(end);
    if (!crewId) next.crew = 'Choose who is working.';
    if (!validDate) next.date = 'Use a date like 2026-10-05.';
    if (startTime === undefined) next.start = 'Try a time like 8:00a or 14:30.';
    if (endTime === undefined) next.end = 'Try a time like 4:30p or 16:30.';
    if (startTime && endTime && endTime <= startTime) next.end = 'End must be after the start.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id,
        values: {
          crew_id: crewId,
          shift_date: date,
          start_time: startTime ?? null,
          end_time: endTime ?? null,
          notes: notes.trim() || null,
        },
      });
      router.back();
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
      router.back();
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
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.date}
            />
          </View>
          {validDate ? (
            <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
              <IconButton
                icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                label="Day before"
                onPress={() => setDate(addDays(date, -1))}
              />
              <IconButton
                icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                label="Day after"
                onPress={() => setDate(addDays(date, 1))}
              />
            </View>
          ) : null}
        </View>
        {validDate ? <AppText muted>{longDay(date)}</AppText> : null}
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Start"
              value={start}
              onChangeText={setStart}
              placeholder="8:00a"
              autoCapitalize="none"
              error={errors.start}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="End"
              value={end}
              onChangeText={setEnd}
              placeholder="4:30p"
              autoCapitalize="none"
              error={errors.end}
            />
          </View>
        </View>
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
            You can still save it. The shift will show as a conflict until it’s resolved.
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
      <Button
        label={existing ? 'Save changes' : 'Add shift'}
        onPress={onSave}
        loading={save.isPending}
        disabled={busy}
      />
      {existing ? <Button label="Delete shift" variant="danger" onPress={onDelete} disabled={busy} /> : null}
    </Screen>
  );
}
