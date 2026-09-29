import { View } from 'react-native';

import { AppText, Badge, Button, Card, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePublishWeek, useScheduleWeek, useUnpublishWeek, useWeekRecipients } from '@/features/schedule';
import type { Tables } from '@/lib/database.types';
import { confirmAction, errorMessage } from '@/lib/confirm';
import { addDays, rangeLabel } from '@/lib/dates';

type Props = {
  week: string;
  isAdmin: boolean;
  crewById: Map<string, Tables<'crew'>>;
};

const names = (list: string[]) =>
  list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}`;

/**
 * Draft or published, for the week on screen. Admins publish a draft week
 * (staff can't see it until then) and send updates after changing a
 * published one. Staff just learn when a week isn't posted yet.
 */
export function PublishBar({ week, isAdmin, crewById }: Props) {
  const state = useScheduleWeek(week);
  const draft = state.data === null;
  const changed = state.data?.changed_crew ?? [];
  const pending = draft || changed.length > 0;
  const recipients = useWeekRecipients(week, isAdmin && pending && !state.isPending);
  const publish = usePublishWeek();
  const unpublish = useUnpublishWeek();
  const label = rangeLabel(week, addDays(week, 6));

  if (state.isPending) return null;
  if (!isAdmin) {
    return draft ? (
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        This week’s schedule hasn’t been posted yet.
      </AppText>
    ) : null;
  }

  const error = state.error ?? publish.error ?? unpublish.error;
  const people = (recipients.data ?? []).map((r) => ({ ...r, name: crewById.get(r.crew_id)?.name ?? 'Someone' }));
  const told = people.filter((p) => p.has_account);
  const untold = people.filter((p) => !p.has_account).map((p) => p.name);
  const changedNames = changed.map((id) => crewById.get(id)?.name ?? 'someone');

  async function onPublish() {
    const who = told.length === 1 ? '1 person' : `${told.length} people`;
    const message = told.length
      ? `${who} will get a push and email with their shifts.${untold.length ? ` ${names(untold)} ${untold.length === 1 ? 'has' : 'have'} no account yet.` : ''}`
      : 'No one with an account is scheduled this week, so no one is notified.';
    const ok = await confirmAction(
      draft ? `Publish ${label}?` : `Send the update for ${label}?`,
      draft ? `Staff will see this week. ${message}` : message,
      draft ? 'Publish' : 'Send',
    );
    if (ok) publish.mutate({ week, notify: true });
  }

  async function onSkip() {
    const ok = await confirmAction(
      'Don’t send an update?',
      'The changes stay on the schedule; no one is notified.',
      'Don’t send',
    );
    if (ok) publish.mutate({ week, notify: false });
  }

  async function onUnpublish() {
    const ok = await confirmAction(
      `Move ${label} back to draft?`,
      'Staff won’t see this week until you publish it again. No one is notified.',
      'Back to draft',
    );
    if (ok) unpublish.mutate(week);
  }

  if (!pending) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
        <Badge label="Published" tone="primary" />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          Staff can see this week.
        </AppText>
        <Button compact variant="secondary" label="Back to draft" loading={unpublish.isPending} onPress={onUnpublish} />
        <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      </View>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <Badge label={draft ? 'Draft' : 'Changed'} tone="accent" />
        <AppText variant="label" style={{ flex: 1 }}>
          {draft ? 'Staff can’t see this week yet' : 'Changes not sent yet'}
        </AppText>
      </View>
      <AppText variant="caption" muted>
        {draft
          ? 'Publish when the week is ready. Everyone scheduled gets a push and email with their shifts.'
          : `You changed shifts for ${names(changedNames)}. The schedule already shows it; send an update to let them know.`}
      </AppText>
      <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
        <Button
          compact
          label={draft ? 'Publish week' : 'Send update'}
          loading={publish.isPending}
          disabled={recipients.isPending}
          onPress={onPublish}
        />
        {!draft ? <Button compact variant="secondary" label="Don’t send" onPress={onSkip} /> : null}
      </View>
    </Card>
  );
}
