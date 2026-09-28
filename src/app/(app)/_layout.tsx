import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '@/components/ui';
import { useTimecardsHidden } from '@/features/timecards';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function AppTabsLayout() {
  const theme = useTheme();
  const { isAdmin } = useAuth();
  // Crew set to not need timecards don't see the tab (PRD §10); admins keep it for the crew view.
  const hideTimecards = useTimecardsHidden() === true && !isAdmin;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
          tabBarIcon: ({ color }) => (
            <Icon name={{ ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
