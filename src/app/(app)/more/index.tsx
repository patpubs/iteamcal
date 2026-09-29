import { router } from 'expo-router';
import { View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  Columns,
  Divider,
  Icon,
  ListRow,
  PageHeader,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useUnreadCount } from '@/features/notifications';
import { useProfiles } from '@/features/team';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function MoreScreen() {
  const theme = useTheme();
  const { profile, isAdmin, signOut } = useAuth();
  const profiles = useProfiles();
  const unread = useUnreadCount();
  const pendingCount = isAdmin ? (profiles.data?.filter((p) => p.approval === 'pending').length ?? 0) : 0;

  return (
    <Screen>
      <PageHeader title="More" />
      <Columns
        sideFirst
        sideWidth={340}
        side={
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
        }
        main={
          <>
            <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
              <ListRow
                title="Notifications"
                subtitle="Time off decisions and timecard changes"
                leading={
                  <Icon name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} color={theme.primary} />
                }
                trailing={unread > 0 ? <Badge label={`${unread} new`} tone="danger" /> : null}
                onPress={() => router.push('/more/notifications')}
              />
              <Divider />
              <ListRow
                title="Settings"
                subtitle="Push notifications and time format"
                leading={
                  <Icon name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} color={theme.primary} />
                }
                onPress={() => router.push('/more/settings')}
              />
            </Card>

            {isAdmin ? (
              <>
                <SectionTitle>Manage</SectionTitle>
                <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
                  <ListRow
                    title="Users"
                    subtitle="Approve sign-ins, admins, and crew links"
                    leading={<Icon name={{ ios: 'person.2', android: 'group', web: 'group' }} color={theme.primary} />}
                    trailing={pendingCount > 0 ? <Badge label={`${pendingCount} waiting`} tone="accent" /> : null}
                    onPress={() => router.push('/more/users')}
                  />
                  <Divider />
                  <ListRow
                    title="Crew"
                    subtitle="Roster, colors, full-time, and timecard settings"
                    leading={<Icon name={{ ios: 'person.3', android: 'badge', web: 'badge' }} color={theme.primary} />}
                    onPress={() => router.push('/more/crew')}
                  />
                  <Divider />
                  <ListRow
                    title="Holidays"
                    subtitle="Office closures shown on the schedule"
                    leading={<Icon name={{ ios: 'flag', android: 'flag', web: 'flag' }} color={theme.primary} />}
                    onPress={() => router.push('/more/holidays')}
                  />
                  <Divider />
                  <ListRow
                    title="Send a message"
                    subtitle="Push a shift change or weather alert to the team"
                    leading={
                      <Icon name={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }} color={theme.primary} />
                    }
                    onPress={() => router.push('/more/message')}
                  />
                </Card>
              </>
            ) : null}
          </>
        }
      />
    </Screen>
  );
}
