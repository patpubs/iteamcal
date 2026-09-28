import { Stack, useLocalSearchParams } from 'expo-router';
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
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { displayName, useCrew, useProfiles, useUpdateProfile } from '@/features/team';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage } from '@/lib/confirm';
import { useAuth } from '@/providers/auth';

export default function UserScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const profiles = useProfiles();
  const crew = useCrew();
  const update = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const [choosingCrew, setChoosingCrew] = useState(false);

  if (profiles.isPending || crew.isPending) return <Loading />;
  const user = profiles.data?.find((p) => p.id === id);
  if (!user) {
    return (
      <Screen underHeader>
        <AppText muted>This account no longer exists.</AppText>
      </Screen>
    );
  }

  const isMe = user.id === me?.id;
  const name = displayName(user, crew.data);
  const linked = user.crew_id ? crew.data?.find((c) => c.id === user.crew_id) : undefined;
  const linkedIds = new Set(profiles.data?.map((p) => p.crew_id).filter(Boolean));
  const available = crew.data?.filter((c) => !c.archived_at && !linkedIds.has(c.id)) ?? [];

  async function apply(change: Parameters<typeof update.mutateAsync>[0]['change']) {
    setError(null);
    try {
      await update.mutateAsync({ id: user!.id, change });
      setChoosingCrew(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const statusBadge = {
    pending: <Badge label="Waiting for approval" tone="accent" />,
    approved: <Badge label="Approved" tone="primary" />,
    rejected: <Badge label="No access" tone="danger" />,
  }[user.approval];

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: name }} />

      <Card>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="heading">{name}</AppText>
          <AppText muted>{user.email}</AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
          {statusBadge}
          <Badge
            label={user.role === 'admin' ? 'Admin' : 'Staff'}
            tone={user.role === 'admin' ? 'primary' : 'neutral'}
          />
        </View>
        <ErrorText>{error}</ErrorText>
      </Card>

      <SectionTitle>Access</SectionTitle>
      <Card>
        {user.approval === 'pending' ? (
          <>
            <AppText muted>Approve to let {name} see the schedule, request time off, and use timecards.</AppText>
            <Button label="Approve" loading={update.isPending} onPress={() => apply({ approval: 'approved' })} />
            <Button
              label="Reject"
              variant="danger"
              disabled={update.isPending}
              onPress={async () => {
                if (await confirmAction(`Reject ${name}?`, 'They won’t be able to see anything in iTeamCal.', 'Reject'))
                  apply({ approval: 'rejected' });
              }}
            />
          </>
        ) : user.approval === 'approved' ? (
          <>
            <AppText muted>
              {user.role === 'admin'
                ? 'Admins manage the schedule, crew, time off, timecards, and users.'
                : 'Staff see the schedule, request time off, and keep their own timecards.'}
            </AppText>
            <Button
              label={user.role === 'admin' ? 'Remove admin role' : 'Make admin'}
              variant="secondary"
              loading={update.isPending}
              onPress={async () => {
                if (user.role === 'admin') {
                  const ok = await confirmAction(
                    isMe ? 'Remove your own admin role?' : `Remove admin role from ${name}?`,
                    isMe ? 'You’ll lose access to admin pages right away.' : 'They’ll keep access as staff.',
                    'Remove',
                  );
                  if (ok) apply({ role: 'staff' });
                } else {
                  apply({ role: 'admin' });
                }
              }}
            />
            {!isMe ? (
              <Button
                label="Revoke access"
                variant="danger"
                disabled={update.isPending}
                onPress={async () => {
                  if (
                    await confirmAction(
                      `Revoke access for ${name}?`,
                      'They’ll be signed out of the schedule immediately. You can approve them again later.',
                      'Revoke',
                    )
                  )
                    apply({ approval: 'rejected' });
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            <AppText muted>{name} can’t see anything in iTeamCal.</AppText>
            <Button label="Approve access" loading={update.isPending} onPress={() => apply({ approval: 'approved' })} />
          </>
        )}
      </Card>

      <SectionTitle>Crew member</SectionTitle>
      <Card style={choosingCrew ? { paddingVertical: Spacing.xs, gap: 0 } : undefined}>
        {choosingCrew ? (
          <>
            {available.length === 0 ? (
              <AppText muted style={{ paddingVertical: Spacing.md }}>
                Every active crew member is already linked. Add someone on the Crew page first.
              </AppText>
            ) : (
              available.map((c, i) => (
                <View key={c.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={c.name}
                    subtitle={c.job_label}
                    leading={<ColorDot color={c.color} />}
                    onPress={() => apply({ crew_id: c.id })}
                  />
                </View>
              ))
            )}
            <View style={{ paddingVertical: Spacing.sm }}>
              <Button label="Cancel" variant="secondary" onPress={() => setChoosingCrew(false)} />
            </View>
          </>
        ) : linked ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <ColorDot color={linked.color} />
              <AppText variant="label">{linked.name}</AppText>
            </View>
            <AppText muted>
              {name}’s time off and requests use this crew record
              {linked.hide_timecards ? '. This crew member is set to not need timecards.' : '.'}
            </AppText>
            <Button label="Change crew member" variant="secondary" onPress={() => setChoosingCrew(true)} />
            <Button
              label="Unlink"
              variant="danger"
              disabled={update.isPending}
              onPress={async () => {
                if (
                  await confirmAction(
                    `Unlink ${linked.name}?`,
                    `${user.display_name ?? 'This account'} won’t be able to request time off until linked again.`,
                    'Unlink',
                  )
                )
                  apply({ crew_id: null });
              }}
            />
          </>
        ) : (
          <>
            <AppText muted>
              {user.approval === 'approved'
                ? 'Not linked yet. Linking lets this person request time off and see their own days off.'
                : 'Approve this account before linking it to a crew member.'}
            </AppText>
            {user.approval === 'approved' ? (
              <Button label="Link to crew member" onPress={() => setChoosingCrew(true)} />
            ) : null}
          </>
        )}
      </Card>
      {user.approval !== 'approved' && linked ? (
        <AppText variant="caption" style={{ color: theme.textMuted }}>
          The crew link is kept while access is off, so approving again restores it.
        </AppText>
      ) : null}
    </Screen>
  );
}
