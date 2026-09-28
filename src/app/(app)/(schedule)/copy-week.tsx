import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, ErrorText, IconButton, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCopyWeek, useScheduleRange, useUndoCopyWeek } from '@/features/schedule';
import { useCrew } from '@/features/team';
import { confirmAction, errorMessage } from '@/lib/confirm';
import { addDays, isDay, rangeLabel, today, weekStart } from '@/lib/dates';

/** Adds one week's shifts to another week, with a one-step undo (PRD §5). */
export default function CopyWeekScreen() {
  const params = useLocalSearchParams<{ from?: string }>();
  const from = weekStart(params.from && isDay(params.from) ? params.from : today());
  const [to, setTo] = useState(addDays(from, 7));
  const [done, setDone] = useState<{ batchId: string; copied: number; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const crew = useCrew();
  const source = useScheduleRange(from, addDays(from, 6));
  const target = useScheduleRange(to, addDays(to, 6));
  const copy = useCopyWeek();
  const undo = useUndoCopyWeek();

  if (source.shifts.isPending || crew.isPending) return <Loading />;
  const active = new Set(crew.data?.filter((c) => !c.archived_at).map((c) => c.id));
  const count = (source.shifts.data ?? []).filter((s) => active.has(s.crew_id)).length;
  const already = (target.shifts.data ?? []).length;

  async function onCopy() {
    setError(null);
    try {
      const result = await copy.mutateAsync({ from, to });
      setDone({ batchId: result.batch_id, copied: result.copied, to });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onUndo() {
    if (!done) return;
    const ok = await confirmAction(
      'Undo the copy?',
      `This removes the ${done.copied} copied shifts from ${rangeLabel(done.to, addDays(done.to, 6))}, including any you edited since.`,
      'Undo copy',
    );
    if (!ok) return;
    try {
      await undo.mutateAsync(done.batchId);
      setDone(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (done) {
    return (
      <Screen underHeader>
        <Stack.Screen options={{ title: 'Copy week' }} />
        <Card>
          <AppText variant="heading">{`Copied ${done.copied} shift${done.copied === 1 ? '' : 's'}`}</AppText>
          <AppText muted>{`Into ${rangeLabel(done.to, addDays(done.to, 6))}.`}</AppText>
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button
          label="See that week"
          onPress={() => router.dismissTo({ pathname: '/', params: { view: 'week', date: done.to } })}
        />
        <Button label="Undo the copy" variant="danger" onPress={onUndo} loading={undo.isPending} />
      </Screen>
    );
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: 'Copy week' }} />
      <Card>
        <AppText variant="caption" muted>
          COPY FROM
        </AppText>
        <AppText variant="heading">{rangeLabel(from, addDays(from, 6))}</AppText>
        <AppText muted>{`${count} shift${count === 1 ? '' : 's'}`}</AppText>
      </Card>
      <Card>
        <AppText variant="caption" muted>
          INTO
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          <IconButton
            icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            label="Earlier week"
            onPress={() => setTo(addDays(to, -7))}
          />
          <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }}>
            {rangeLabel(to, addDays(to, 6))}
          </AppText>
          <IconButton
            icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            label="Later week"
            onPress={() => setTo(addDays(to, 7))}
          />
        </View>
        <AppText muted>
          {to === from
            ? 'That’s the same week. Pick another one.'
            : already
              ? `That week already has ${already} shift${already === 1 ? '' : 's'}. They stay, and the copies are added alongside them.`
              : 'That week is empty.'}
        </AppText>
      </Card>
      <AppText variant="caption" muted>
        Only shifts are copied. Time off and holidays aren’t, so check the new week for conflicts afterwards.
      </AppText>
      <ErrorText>{error}</ErrorText>
      <Button
        label={`Copy ${count} shift${count === 1 ? '' : 's'}`}
        onPress={onCopy}
        loading={copy.isPending}
        disabled={to === from || count === 0}
      />
    </Screen>
  );
}
