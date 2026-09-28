import { View } from 'react-native';

import { DatePicker } from '@/components/date-picker';
import { AppText, Badge, Chip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { TIME_OFF_TYPES, type TimeOffType } from '@/features/time-off';
import { longDay } from '@/lib/dates';
import { pickRange, rangeDays, rangeText } from '@/lib/time-off';

const TONES = { vacation: 'accent', sick: 'danger', personal: 'primary', other: 'neutral' } as const;

export function TypeBadge({ type }: { type: TimeOffType | null }) {
  if (!type) return <Badge label="Off" />;
  return <Badge label={TIME_OFF_TYPES.find((t) => t.value === type)!.label} tone={TONES[type]} />;
}

export function TypePicker({ value, onChange }: { value: TimeOffType; onChange: (t: TimeOffType) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
      {TIME_OFF_TYPES.map((t) => (
        <Chip key={t.value} label={t.label} selected={t.value === value} onPress={() => onChange(t.value)} />
      ))}
    </View>
  );
}

export type RangeState = { start: string | null; end: string | null };

/** Tap the first day, then the last day. One tap twice picks a single day. */
export function RangePicker({ value, onChange }: { value: RangeState; onChange: (r: RangeState) => void }) {
  const { start, end } = value;
  const selected = start ? rangeDays({ start_date: start, end_date: end ?? start }) : [];
  return (
    <View style={{ gap: Spacing.sm }}>
      <DatePicker
        selected={selected}
        initialMonth={start ?? undefined}
        onPress={(d) => onChange(pickRange(value, d))}
      />
      <AppText variant="label" accessibilityLiveRegion="polite">
        {!start
          ? 'Tap the first day off.'
          : !end
            ? `${longDay(start)}. Tap the last day, or the same day again for one day.`
            : rangeText({ start_date: start, end_date: end })}
      </AppText>
    </View>
  );
}
