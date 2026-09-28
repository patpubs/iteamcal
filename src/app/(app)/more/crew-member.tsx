import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, SwitchRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  CREW_COLORS,
  suggestColor,
  type Crew,
  useCrew,
  useDeleteCrew,
  useProfiles,
  useSaveCrew,
  useSetCrewArchived,
} from '@/features/team';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage, goBack } from '@/lib/confirm';

export default function CrewMemberScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const crew = useCrew();

  if (crew.isPending) return <Loading />;
  const existing = id ? crew.data?.find((c) => c.id === id) : undefined;
  if (id && !existing) {
    return (
      <Screen underHeader>
        <AppText muted>This crew member no longer exists.</AppText>
      </Screen>
    );
  }
  return <CrewForm key={existing?.id ?? 'new'} existing={existing} allCrew={crew.data ?? []} />;
}

function CrewForm({ existing, allCrew }: { existing?: Crew; allCrew: Crew[] }) {
  const theme = useTheme();
  const profiles = useProfiles();
  const save = useSaveCrew();
  const setArchived = useSetCrewArchived();
  const remove = useDeleteCrew();

  const [name, setName] = useState(existing?.name ?? '');
  const [jobLabel, setJobLabel] = useState(existing?.job_label ?? '');
  const [color, setColor] = useState<string>(existing?.color ?? suggestColor(allCrew));
  const [fullTime, setFullTime] = useState(existing?.full_time ?? false);
  const [hideTimecards, setHideTimecards] = useState(existing?.hide_timecards ?? false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const chosenColor = color;
  const account = existing ? profiles.data?.find((p) => p.crew_id === existing.id) : undefined;
  const busy = save.isPending || setArchived.isPending || remove.isPending;

  async function onSave() {
    if (!name.trim()) {
      setNameError('Enter a name.');
      return;
    }
    setNameError(null);
    setError(null);
    const maxOrder = Math.max(0, ...allCrew.map((c) => c.sort_order));
    try {
      await save.mutateAsync({
        id: existing?.id,
        values: {
          name: name.trim(),
          job_label: jobLabel.trim() || null,
          color: chosenColor,
          full_time: fullTime,
          hide_timecards: hideTimecards,
          ...(existing ? {} : { sort_order: maxOrder + 1 }),
        },
      });
      goBack('/more');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onArchive(archived: boolean) {
    if (!existing) return;
    if (archived) {
      const ok = await confirmAction(
        `Archive ${existing.name}?`,
        `They’ll be hidden from the roster and schedule${account ? `, and ${account.email} will be unlinked` : ''}. Their history is kept, and you can restore them later.`,
        'Archive',
      );
      if (!ok) return;
    }
    setError(null);
    try {
      await setArchived.mutateAsync({ id: existing.id, archived });
      goBack('/more');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(
      `Permanently delete ${existing.name}?`,
      'This also deletes all of their shifts, time off, and time-off requests. It can’t be undone. Archive instead if you might need their history.',
      'Delete forever',
    );
    if (!ok) return;
    setError(null);
    try {
      await remove.mutateAsync(existing.id);
      goBack('/more');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: existing ? existing.name : 'Add crew member' }} />

      <Card>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="First and last name"
          autoCapitalize="words"
          error={nameError}
        />
        <Field label="Job title (optional)" value={jobLabel} onChangeText={setJobLabel} placeholder="e.g. Crew lead" />
        <AppText variant="caption" muted>
          Job title is just a label. It doesn’t change what someone can do in the app.
        </AppText>
      </Card>

      <SectionTitle>Color</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {CREW_COLORS.map((c) => {
            const selected = c.toUpperCase() === chosenColor.toUpperCase();
            const takenBy = allCrew.find(
              (m) => !m.archived_at && m.id !== existing?.id && m.color.toUpperCase() === c.toUpperCase(),
            );
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={takenBy ? `${c}, also used by ${takenBy.name}` : c}
                onPress={() => setColor(c)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c,
                  borderWidth: 3,
                  borderColor: selected ? theme.text : 'transparent',
                  opacity: takenBy && !selected ? 0.45 : 1,
                }}
              />
            );
          })}
        </View>
        <AppText variant="caption" muted>
          Faded colors are already used by someone else. Colors don’t have to be unique.
        </AppText>
      </Card>

      <SectionTitle>Settings</SectionTitle>
      <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
        <SwitchRow
          label="Full-time"
          help="Kept off the variable shift schedule. Time off still shows."
          value={fullTime}
          onValueChange={setFullTime}
        />
        <SwitchRow
          label="No timecards needed"
          help="Hides timecards for their account and leaves them out of crew hour totals."
          value={hideTimecards}
          onValueChange={setHideTimecards}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button
        label={existing ? 'Save changes' : 'Add crew member'}
        onPress={onSave}
        loading={save.isPending}
        disabled={busy}
      />

      {existing ? (
        <>
          <SectionTitle>Remove</SectionTitle>
          <Card>
            {existing.archived_at ? (
              <Button label="Restore to roster" variant="secondary" onPress={() => onArchive(false)} disabled={busy} />
            ) : (
              <Button label="Archive" variant="secondary" onPress={() => onArchive(true)} disabled={busy} />
            )}
            <Button label="Delete permanently" variant="danger" onPress={onDelete} disabled={busy} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
