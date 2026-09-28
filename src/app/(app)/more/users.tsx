import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Badge, Card, ColorDot, Divider, ErrorText, ListRow, Loading, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { displayName, useCrew, useProfiles, type Profile } from '@/features/team';
import { errorMessage } from '@/lib/confirm';

const GROUPS: { key: Profile['approval']; title: string; empty: string }[] = [
  { key: 'pending', title: 'Waiting for approval', empty: 'No one is waiting.' },
  { key: 'approved', title: 'Team', empty: 'No approved accounts yet.' },
  { key: 'rejected', title: 'No access', empty: 'No one has been turned away.' },
];

export default function UsersScreen() {
  const profiles = useProfiles();
  const crew = useCrew();

  if (profiles.isPending) return <Loading />;

  return (
    <Screen underHeader>
      <AppText muted>
        New sign-ins wait here until you approve them. Link each person to their crew member so they can request
        time off.
      </AppText>
      <ErrorText>{profiles.error ? errorMessage(profiles.error) : null}</ErrorText>

      {GROUPS.map((group) => {
        const rows = profiles.data?.filter((p) => p.approval === group.key) ?? [];
        if (group.key === 'rejected' && rows.length === 0) return null;
        return (
          <View key={group.key} style={{ gap: Spacing.sm }}>
            <SectionTitle>{`${group.title} (${rows.length})`}</SectionTitle>
            <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
              {rows.length === 0 ? (
                <AppText muted style={{ paddingVertical: Spacing.md }}>
                  {group.empty}
                </AppText>
              ) : (
                rows.map((p, i) => {
                  const linked = p.crew_id ? crew.data?.find((c) => c.id === p.crew_id) : undefined;
                  return (
                    <View key={p.id}>
                      {i > 0 ? <Divider /> : null}
                      <ListRow
                        title={displayName(p, crew.data)}
                        subtitle={
                          group.key === 'approved'
                            ? `${p.email} · ${linked ? `Crew: ${linked.name}` : 'Not linked to crew'}`
                            : p.email
                        }
                        leading={<ColorDot color={linked?.color ?? 'transparent'} />}
                        trailing={p.role === 'admin' ? <Badge label="Admin" tone="primary" /> : null}
                        onPress={() => router.push({ pathname: '/more/user', params: { id: p.id } })}
                      />
                    </View>
                  );
                })
              )}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
