import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth';

/** Shown to signed-in accounts that can't use the app yet (PRD §3). */
export default function AccessScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const email = profile?.email ?? session?.user.email ?? 'your account';

  const content = !profile
    ? {
        title: 'We couldn’t load your account',
        body: 'Check your connection and try again.',
      }
    : profile.approval === 'rejected'
      ? {
          title: 'Access not approved',
          body: `${email} doesn’t have access to iTeamCal. If you think this is a mistake, ask your manager.`,
        }
      : {
          title: 'Waiting for approval',
          body: `You’re signed in as ${email}. A manager needs to approve your account before you can see the schedule. This page updates on its own once they do.`,
        };

  return (
    <Screen>
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', paddingTop: Spacing.xxl }}>
        <Card>
          <AppText variant="heading">{content.title}</AppText>
          <AppText muted>{content.body}</AppText>
          <Button
            label="Check again"
            loading={checking}
            onPress={async () => {
              setChecking(true);
              await refreshProfile();
              setChecking(false);
            }}
          />
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </Card>
      </View>
    </Screen>
  );
}
