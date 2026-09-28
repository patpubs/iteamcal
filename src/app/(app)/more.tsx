import { View } from 'react-native';

import { AppText, Button, Card, ComingSoon, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function MoreScreen() {
  const theme = useTheme();
  const { profile, isAdmin, signOut } = useAuth();

  return (
    <Screen>
      <AppText variant="title">More</AppText>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.pill,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppText variant="heading" style={{ color: theme.primary }}>
              {(profile?.display_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{profile?.display_name}</AppText>
            <AppText variant="caption" muted>
              {profile?.email} · {isAdmin ? 'Admin' : 'Staff'}
            </AppText>
          </View>
        </View>
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </Card>

      {isAdmin ? (
        <ComingSoon
          phase="Coming in phase 1"
          title="Manage the team"
          items={[
            'Approve new accounts and choose who is an admin',
            'Crew roster with colors, full-time, and timecard settings',
            'Link each account to its crew member',
          ]}
        />
      ) : null}
    </Screen>
  );
}
