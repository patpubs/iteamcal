import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

export default function MoreLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'More' }} />
      {/* Admin pages. The database enforces the same rule; this only hides them. */}
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="users" options={{ title: 'Users' }} />
        <Stack.Screen name="user" options={{ title: 'User' }} />
        <Stack.Screen name="crew" options={{ title: 'Crew' }} />
        <Stack.Screen name="crew-member" options={{ title: 'Crew member' }} />
        <Stack.Screen name="holidays" options={{ title: 'Holidays' }} />
        <Stack.Screen name="holiday" options={{ title: 'Holiday' }} />
      </Stack.Protected>
    </Stack>
  );
}
