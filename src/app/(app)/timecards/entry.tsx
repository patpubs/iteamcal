import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { displayName, useCrew, useProfiles } from '@/features/team';
import { type Timecard, useDeleteTimecard, useSaveTimecard, useTimecard } from '@/features/timecards';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage, goBack } from '@/lib/confirm';
import { isDay, longDay, today } from '@/lib/dates';
import { formatTime } from '@/lib/time-format';
import { type CardErrors, type CardInput, formatHours, netHours, readCard } from '@/lib/timecards';
import { useAuth } from '@/providers/auth';

/**
 * Add a missing day or fix an existing card. Staff edit their own; admins
 * can edit anyone's, and the owner is notified of edits and deletes (PRD §10).
 */
export default function TimecardEntryScreen() {
  const params = useLocalSearchParams<{ id?: string; user?: string; date?: string }>();
  const { profile, isAdmin } = useAuth();
  const card = useTimecard(params.id);
  const profiles = useProfiles();
  const crew = useCrew();

  if ((params.id && card.isPending) || (isAdmin && (profiles.isPending || crew.isPending))) return <Loading />;
  if (params.id && !card.data) {
    return (
      <Screen underHeader>
        <AppText muted>This timecard was deleted.</AppText>
      </Screen>
    );
  }
  const userId = card.data?.user_id ?? (isAdmin && params.user ? params.user : profile!.id);
  const date = card.data?.work_date ?? (params.date && isDay(params.date) ? params.date : today());
  const owner = profiles.data?.find((p) => p.id === userId);
  const someoneElse = userId !== profile!.id;
  return (
    <EntryForm
      key={card.data?.id ?? `${userId}-${date}`}
      existing={card.data ?? undefined}
      userId={userId}
      date={date}
      ownerName={someoneElse && owner ? displayName(owner, crew.data) : null}
    />
  );
}

function EntryForm({
  existing,
  userId,
  date,
  ownerName,
}: {
  existing?: Timecard;
  userId: string;
  date: string;
  ownerName: string | null;
}) {
  const theme = useTheme();
  const save = useSaveTimecard();
  const remove = useDeleteTimecard();
  const [input, setInput] = useState<CardInput>({
    start: existing ? formatTime(existing.start_time) : '',
    end: existing?.end_time ? formatTime(existing.end_time) : '',
    lunchStart: existing?.lunch_start ? formatTime(existing.lunch_start) : '',
    lunchEnd: existing?.lunch_end ? formatTime(existing.lunch_end) : '',
  });
  const [errors, setErrors] = useState<CardErrors>({});
  const [error, setError] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending;
  const future = date > today();

  const preview = readCard(input).values;
  const hours = preview ? netHours(preview) : null;
  const set = (key: keyof CardInput) => (value: string) => setInput((i) => ({ ...i, [key]: value }));

  async function onSave() {
    const { values, errors: next } = readCard(input);
    setErrors(next);
    if (!values) return;
    setError(null);
    try {
      await save.mutateAsync({ id: existing?.id, userId, workDate: date, times: values });
      goBack('/timecards');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(
      'Delete this timecard?',
      `${ownerName ? `${ownerName}, ` : ''}${longDay(date)}.${ownerName ? ' They’ll get a notification.' : ''}`,
      'Delete',
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      goBack('/timecards');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: existing ? 'Edit timecard' : 'Add timecard' }} />
      <View style={{ gap: 2 }}>
        {ownerName ? <AppText variant="label">{ownerName}</AppText> : null}
        <AppText variant="heading">{longDay(date)}</AppText>
      </View>

      {future ? (
        <Card>
          <AppText muted>Timecards can’t be added for days that haven’t happened yet.</AppText>
        </Card>
      ) : (
        <>
          <Card>
            <AppText variant="label">Shift</AppText>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Start"
                  value={input.start}
                  onChangeText={set('start')}
                  placeholder={formatTime('08:00')}
                  autoCapitalize="none"
                  error={errors.start}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="End"
                  value={input.end}
                  onChangeText={set('end')}
                  placeholder={formatTime('16:30')}
                  autoCapitalize="none"
                  error={errors.end}
                />
              </View>
            </View>
            <AppText variant="caption" muted>
              Leave the end blank if the shift is still going.
            </AppText>
          </Card>

          <Card>
            <AppText variant="label">Lunch (optional)</AppText>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Started"
                  value={input.lunchStart}
                  onChangeText={set('lunchStart')}
                  placeholder={formatTime('12:00')}
                  autoCapitalize="none"
                  error={errors.lunchStart}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Ended"
                  value={input.lunchEnd}
                  onChangeText={set('lunchEnd')}
                  placeholder={formatTime('12:30')}
                  autoCapitalize="none"
                  error={errors.lunchEnd}
                />
              </View>
            </View>
          </Card>

          <Card style={{ backgroundColor: theme.primarySoft, borderColor: theme.primarySoft }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText variant="label">Hours</AppText>
              <AppText variant="heading" style={{ color: theme.primary }}>
                {hours != null ? formatHours(hours) : '—'}
              </AppText>
            </View>
            <AppText variant="caption" muted>
              {hours != null
                ? 'Shift minus lunch.'
                : input.start && input.end
                  ? 'Fix the times above to see the hours.'
                  : 'Hours show once the start and end are filled in.'}
            </AppText>
          </Card>

          {ownerName && existing ? (
            <AppText variant="caption" muted>
              {`${ownerName} will get a notification about this change.`}
            </AppText>
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Button
            label={existing ? 'Save changes' : 'Add timecard'}
            onPress={onSave}
            loading={save.isPending}
            disabled={busy}
          />
        </>
      )}
      {existing ? <Button label="Delete timecard" variant="danger" onPress={onDelete} disabled={busy} /> : null}
    </Screen>
  );
}
