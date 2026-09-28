import { View } from 'react-native';

import { AppText, Card, ColorDot, Divider, ErrorText, IconButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useReorderCrew } from '@/features/schedule';
import type { Crew } from '@/features/team';
import { errorMessage } from '@/lib/confirm';
import { moveId } from '@/lib/schedule';

/** Sets the order crew appear in on the schedule. */
export function ReorderList({ crew }: { crew: Crew[] }) {
  const reorder = useReorderCrew();
  const ids = crew.map((c) => c.id);
  return (
    <View style={{ gap: Spacing.sm }}>
      <AppText muted>Move people up or down. Everyone sees the new order right away.</AppText>
      <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
        {crew.map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs }}>
              <ColorDot color={c.color} size={12} />
              <AppText variant="label" style={{ flex: 1 }}>
                {c.name}
              </AppText>
              <IconButton
                icon={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                label={`Move ${c.name} up`}
                disabled={i === 0 || reorder.isPending}
                onPress={() => reorder.mutate(moveId(ids, c.id, -1))}
              />
              <IconButton
                icon={{ ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' }}
                label={`Move ${c.name} down`}
                disabled={i === crew.length - 1 || reorder.isPending}
                onPress={() => reorder.mutate(moveId(ids, c.id, 1))}
              />
            </View>
          </View>
        ))}
      </Card>
      <ErrorText>{reorder.error ? errorMessage(reorder.error) : null}</ErrorText>
    </View>
  );
}
