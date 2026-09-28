import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function TimeOffLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Time off' }} />
      <Stack.Screen name="request" options={{ title: 'Request time off' }} />
      {/* The database enforces the same rule; this only hides the editor. */}
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="entry" options={{ title: 'Time off' }} />
      </Stack.Protected>
    </Stack>
  );
}
