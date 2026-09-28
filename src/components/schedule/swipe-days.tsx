import { type ReactNode, useMemo } from 'react';
import { PanResponder, View } from 'react-native';

/** Swipe left for the next day, right for the previous one. */
export function SwipeDays({ onStep, children }: { onStep: (dir: -1 | 1) => void; children: ReactNode }) {
  const handlers = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly sideways drags so vertical scrolling still works.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 60) onStep(g.dx < 0 ? 1 : -1);
        },
      }).panHandlers,
    [onStep],
  );
  return <View {...handlers}>{children}</View>;
}
