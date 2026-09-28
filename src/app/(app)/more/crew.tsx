import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  ColorDot,
  Divider,
  ErrorText,
  ListRow,
  Loading,
  Screen,
  SectionTitle,
  SwitchRow,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCrew, useProfiles } from '@/features/team';
import { errorMessage } from '@/lib/confirm';

export default function CrewScreen() {
  const crew = useCrew();
  const profiles = useProfiles();
  const [showArchived, setShowArchived] = useState(false);

  if (crew.isPending) return <Loading />;

  const active = crew.data?.filter((c) => !c.archived_at) ?? [];
  const archived = crew.data?.filter((c) => c.archived_at) ?? [];
  const accountFor = (crewId: string) => profiles.data?.find((p) => p.crew_id === crewId);

  return (
    <Screen underHeader>
      <Button label="Add crew member" onPress={() => router.push('/more/crew-member')} />
      <ErrorText>{crew.error ? errorMessage(crew.error) : null}</ErrorText>

      <View style={{ gap: Spacing.sm }}>
        <SectionTitle>{`Active (${active.length})`}</SectionTitle>
        <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
          {active.length === 0 ? (
            <AppText muted style={{ paddingVertical: Spacing.md }}>
              No crew yet. Add the people who appear on the schedule.
            </AppText>
          ) : (
            active.map((c, i) => {
              const account = accountFor(c.id);
              return (
                <View key={c.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={c.name}
                    subtitle={[c.job_label, account ? account.email : 'No sign-in linked'].filter(Boolean).join(' · ')}
                    leading={<ColorDot color={c.color} size={14} />}
                    footer={
                      c.full_time || c.hide_timecards ? (
                        <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs }}>
                          {c.full_time ? <Badge label="Full-time" /> : null}
                          {c.hide_timecards ? <Badge label="No timecards" tone="accent" /> : null}
                        </View>
                      ) : null
                    }
                    onPress={() => router.push({ pathname: '/more/crew-member', params: { id: c.id } })}
                  />
                </View>
              );
            })
          )}
        </Card>
        <AppText variant="caption" muted>
          Schedule order is set by dragging rows on the weekly schedule.
        </AppText>
      </View>

      {archived.length > 0 ? (
        <View style={{ gap: Spacing.sm }}>
          <Card style={{ paddingVertical: 0 }}>
            <SwitchRow
              label={`Show archived (${archived.length})`}
              value={showArchived}
              onValueChange={setShowArchived}
            />
          </Card>
          {showArchived ? (
            <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
              {archived.map((c, i) => (
                <View key={c.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={c.name}
                    subtitle={c.job_label}
                    leading={<ColorDot color={c.color} size={14} />}
                    trailing={<Badge label="Archived" />}
                    onPress={() => router.push({ pathname: '/more/crew-member', params: { id: c.id } })}
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
