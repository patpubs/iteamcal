import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useNotificationsRealtime, useUnreadCount } from '@/features/notifications';
import { useApplyPreferences } from '@/features/preferences';
import { useSyncPush } from '@/features/push';
import { useRequests } from '@/features/time-off';
import { useTimecardsHidden } from '@/features/timecards';
import { Sidebar } from '@/components/sidebar';
import { useIsDesktop } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function AppTabsLayout() {
  const theme = useTheme();
  const { isAdmin } = useAuth();
  const desktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  // Crew set to not need timecards don't see the tab (PRD §10); admins keep it for the crew view.
  const hideTimecards = useTimecardsHidden() === true && !isAdmin;
  const unread = useUnreadCount();
  // Admins see how many time off requests are waiting on them.
  const { pending } = useRequests();
  const waiting = isAdmin ? (pending.data?.length ?? 0) : 0;
  useNotificationsRealtime();
  useApplyPreferences();
  useSyncPush();
  return (
    <Tabs
      // Desktop gets a sidebar; phones keep the bottom tab bar.
      tabBar={desktop ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        // The default 49pt bar clips the labels on iPhone home screen apps, so
        // give the icon and label a little more room above the home indicator.
        tabBarStyle: desktop
          ? { backgroundColor: theme.surface, borderTopColor: theme.border }
          : { backgroundColor: theme.surface, borderTopColor: theme.border, height: 60 + insets.bottom },
        tabBarItemStyle: desktop ? undefined : { paddingTop: 6, paddingBottom: 4 },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="(schedule)"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => (
            <Icon name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="time-off"
        options={{
          title: 'Time off',
          tabBarBadge: waiting ? waiting : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger, fontSize: 11 },
          tabBarIcon: ({ color }) => (
            <Icon name={{ ios: 'sun.max', android: 'beach_access', web: 'beach_access' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timecards"
        options={{
          title: 'Timecards',
          href: hideTimecards ? null : undefined,
          tabBarIcon: ({ color }) => (
            <Icon name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarBadge: unread ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger, fontSize: 11 },
          tabBarIcon: ({ color }) => (
            <Icon name={{ ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
