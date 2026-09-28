import { useState } from 'react';

import { type RangeState, RangePicker, TypePicker } from '@/components/time-off/parts';
import { AppText, Button, Card, ErrorText, Field, Screen, SectionTitle } from '@/components/ui';
import { type TimeOffType, useSubmitRequest } from '@/features/time-off';
import { errorMessage, goBack } from '@/lib/confirm';
import { today } from '@/lib/dates';
import { useAuth } from '@/providers/auth';

export default function RequestScreen() {
  const { profile } = useAuth();
  const submit = useSubmitRequest();
  const [range, setRange] = useState<RangeState>({ start: null, end: null });
  const [type, setType] = useState<TimeOffType>('vacation');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!profile?.crew_id) {
    return (
      <Screen underHeader>
        <AppText muted>
          Your account isn’t linked to a crew member yet, so you can’t request time off. Ask an admin.
        </AppText>
      </Screen>
    );
  }

  const past = !!range.start && range.start < today();

  async function onSubmit() {
    if (!range.start) return setError('Pick your days off.');
    setError(null);
    try {
      await submit.mutateAsync({
        requesterId: profile!.id,
        crewId: profile!.crew_id!,
        values: { start_date: range.start, end_date: range.end ?? range.start, type, reason: reason.trim() || null },
      });
      goBack('/time-off');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen underHeader>
      <SectionTitle>Days</SectionTitle>
      <Card>
        <RangePicker value={range} onChange={setRange} />
      </Card>
      {past ? (
        <AppText variant="caption" muted>
          That starts in the past. You can still send it, for example to record a sick day.
        </AppText>
      ) : null}
      <SectionTitle>Type</SectionTitle>
      <TypePicker value={type} onChange={setType} />
      <Card>
        <Field
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="e.g. Family trip"
        />
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button label="Send request" onPress={onSubmit} loading={submit.isPending} disabled={!range.start} />
      <AppText variant="caption" muted>
        An admin approves or declines it, and you’ll see their answer here. You can cancel while it’s waiting.
      </AppText>
    </Screen>
  );
}
