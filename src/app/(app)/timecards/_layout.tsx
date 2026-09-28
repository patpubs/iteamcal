import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function TimecardsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Timecards' }} />
      <Stack.Screen name="entry" options={{ title: 'Timecard' }} />
    </Stack>
  );
}
