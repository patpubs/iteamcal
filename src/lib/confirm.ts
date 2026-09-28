import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

/**
 * Ask before a destructive or hard-to-undo action. React Native Web has no
 * Alert buttons, so the browser uses its own confirm dialog.
 */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Turns a Supabase/Postgres error into a sentence people can act on. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const { message, code } = error as { message: string; code?: string };
    if (code === '23505') return 'That already exists.';
    return message;
  }
  return 'Something went wrong. Try again.';
}

/** Back to the previous screen, or to the schedule when the page was opened directly. */
export function goBack(fallback: '/' | '/more' | '/time-off' | '/timecards' = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
