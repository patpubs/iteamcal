import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function ScheduleLayout() {
  const theme = useTheme();
  const { isAdmin } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Schedule' }} />
      {/* The database enforces the same rule; this only hides the editor. */}
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="shift" options={{ title: 'Shift' }} />
        <Stack.Screen name="shift-copy" options={{ title: 'Copy to other days' }} />
        <Stack.Screen name="copy-week" options={{ title: 'Copy week' }} />
      </Stack.Protected>
    </Stack>
  );
}
