import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  type PartDayState,
  PartDayPicker,
  type RangeState,
  RangePicker,
  TypePicker,
} from '@/components/time-off/parts';
import { AppText, Button, Card, Chip, ErrorText, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { type TimeOff, type TimeOffType, useDeleteTimeOff, useSaveTimeOff, useTimeOffEntry } from '@/features/time-off';
import { type Crew, useCrew } from '@/features/team';
import { confirmAction, errorMessage, goBack } from '@/lib/confirm';
import { type HoursErrors, rangeText, readHours } from '@/lib/time-off';
import { formatTime } from '@/lib/time-format';

/** Admins record, edit, or delete a day-off range directly (PRD §7). */
export default function EntryScreen() {
  const { id, crew: crewParam, date } = useLocalSearchParams<{ id?: string; crew?: string; date?: string }>();
  const entry = useTimeOffEntry(id);
  const crew = useCrew();

  if (crew.isPending || (id && entry.isPending)) return <Loading />;
  if (id && !entry.data) {
    return (
      <Screen underHeader>
        <AppText muted>This time off was deleted.</AppText>
      </Screen>
    );
  }
  const choices = (crew.data ?? []).filter((c) => !c.archived_at || c.id === entry.data?.crew_id);
  return (
    <EntryForm
      key={entry.data?.id ?? 'new'}
      existing={entry.data ?? undefined}
      crew={choices}
      initialCrew={crewParam}
      initialDate={date}
    />
  );
}

function EntryForm({
  existing,
  crew,
  initialCrew,
  initialDate,
}: {
  existing?: TimeOff;
  crew: Crew[];
  initialCrew?: string;
  initialDate?: string;
}) {
  const save = useSaveTimeOff();
  const remove = useDeleteTimeOff();
  const [crewId, setCrewId] = useState(existing?.crew_id ?? initialCrew ?? '');
  const [range, setRange] = useState<RangeState>({
    start: existing?.start_date ?? initialDate ?? null,
    end: existing?.end_date ?? initialDate ?? null,
  });
  const [type, setType] = useState<TimeOffType>(existing?.type ?? 'vacation');
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [partDay, setPartDay] = useState<PartDayState>({
    part: !!existing?.start_time,
    from: existing?.start_time ? formatTime(existing.start_time) : '',
    until: existing?.end_time ? formatTime(existing.end_time) : '',
  });
  const [hoursErrors, setHoursErrors] = useState<HoursErrors>({});
  const [error, setError] = useState<string | null>(null);
  const oneDay = !!range.start && (range.end ?? range.start) === range.start;
  const busy = save.isPending || remove.isPending;
  const name = crew.find((c) => c.id === crewId)?.name;

  async function onSave() {
    if (!crewId) return setError('Choose who is off.');
    if (!range.start) return setError('Pick the days off.');
    const hours = oneDay && partDay.part ? readHours(partDay.from, partDay.until) : null;
    setHoursErrors(hours?.errors ?? {});
    if (hours && !hours.values) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id,
        values: {
          crew_id: crewId,
          start_date: range.start,
          end_date: range.end ?? range.start,
          start_time: hours?.values?.start_time ?? null,
          end_time: hours?.values?.end_time ?? null,
          type,
          reason: reason.trim() || null,
        },
      });
      goBack('/time-off');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(
      'Delete this time off?',
      `${name ?? 'Their'} ${rangeText(existing)} is removed from the schedule.${
        existing.request_id ? ' The original request shows as cancelled.' : ''
      } If it hasn’t passed, they get a notification.`,
      'Delete',
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      goBack('/time-off');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: existing ? 'Edit time off' : 'Record time off' }} />
      <SectionTitle>Who</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {crew.map((c) => (
          <Chip key={c.id} label={c.name} color={c.color} selected={c.id === crewId} onPress={() => setCrewId(c.id)} />
        ))}
      </View>
      <SectionTitle>Days</SectionTitle>
      <Card>
        <RangePicker value={range} onChange={setRange} />
        {oneDay ? <PartDayPicker value={partDay} onChange={setPartDay} errors={hoursErrors} /> : null}
      </Card>
      <SectionTitle>Type</SectionTitle>
      <TypePicker value={type} onChange={setType} />
      <Card>
        <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
      </Card>
      {existing?.request_id ? (
        <AppText variant="caption" muted>
          This came from an approved request. Changing it here doesn’t change the request’s history.
        </AppText>
      ) : (
        <AppText variant="caption" muted>
          Recording time off here skips the request step. Shifts during this time stay and show as conflicts.
        </AppText>
      )}
      <ErrorText>{error}</ErrorText>
      <Button
        label={existing ? 'Save changes' : 'Record time off'}
        onPress={onSave}
        loading={save.isPending}
        disabled={busy}
      />
      {existing ? <Button label="Delete time off" variant="danger" onPress={onDelete} disabled={busy} /> : null}
    </Screen>
  );
}
