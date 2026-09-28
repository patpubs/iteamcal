import { type Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, Card, ColorDot, Divider, ErrorText, ListRow, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMarkAllRead, useNotifications } from '@/features/notifications';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/confirm';
import { timeAgo } from '@/lib/dates';

export default function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const markRead = useMarkAllRead();
  // Unread dots stay for this visit so people can see what was new.
  const [wasUnread, setWasUnread] = useState<Set<string> | null>(null);
  if (wasUnread === null && notifications.data) {
    setWasUnread(new Set(notifications.data.filter((n) => !n.read_at).map((n) => n.id)));
  }
  const hasUnread = !!notifications.data?.some((n) => !n.read_at);
  const { mutate } = markRead;
  useEffect(() => {
    if (hasUnread) mutate();
  }, [hasUnread, mutate]);

  if (notifications.isPending) return <Loading />;
  const list = notifications.data ?? [];

  return (
    <Screen underHeader>
      <ErrorText>{notifications.error ? errorMessage(notifications.error) : null}</ErrorText>
      {list.length ? (
        <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
          {list.map((n, i) => (
            <View key={n.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={n.title}
                subtitle={timeAgo(n.created_at)}
                leading={
                  <View style={{ width: 10 }}>
                    {wasUnread?.has(n.id) ? <ColorDot color={theme.accent} size={10} /> : null}
                  </View>
                }
                footer={n.body ? <AppText variant="caption">{n.body}</AppText> : null}
                onPress={n.link ? () => router.push(n.link as Href) : undefined}
              />
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <AppText muted>
            Nothing yet. You’ll hear here, and by email, when a time off request is decided or a manager changes your
            timecard.
          </AppText>
        </Card>
      )}
    </Screen>
  );
}
