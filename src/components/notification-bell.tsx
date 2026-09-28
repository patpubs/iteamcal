import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { useUnreadCount } from '@/features/notifications';
import { useTheme } from '@/hooks/use-theme';

/** Bell with an unread count; opens the notification list. */
export function NotificationBell() {
  const theme = useTheme();
  const unread = useUnreadCount();
  return (
    <View>
      <IconButton
        icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
        label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onPress={() => router.push('/more/notifications')}
      />
      {unread ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: theme.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText variant="caption" style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 }}>
            {unread > 9 ? '9+' : String(unread)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
