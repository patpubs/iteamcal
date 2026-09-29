import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Field, IconButton, Segmented } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseTime } from '@/lib/schedule';
import { formatTime, useTimeFormat } from '@/lib/time-format';

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * Tap-to-pick panel for a time, shown under a time box. Hours, minutes in
 * five-minute steps, and AM/PM (or 0–23 for people who use 24-hour time).
 * Typing still works; picking just fills in the box.
 */
export function TimePicker({
  label,
  value,
  fallback,
  onChange,
  onDone,
}: {
  /** "Start", "End"... read before the panel's buttons. */
  label: string;
  /** What's typed in the box right now. */
  value: string;
  /** "HH:MM" to start from when the box is empty or unreadable. */
  fallback: string;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const format = useTimeFormat();
  const current = parseTime(value) || fallback;
  const [h, m] = current.split(':').map(Number);
  const pm = h >= 12;

  const set = (hour: number, minute: number) =>
    onChange(formatTime(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`));

  const hours = format === '24h' ? Array.from({ length: 24 }, (_, i) => i) : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const hourSelected = (hour: number) => (format === '24h' ? hour === h : hour % 12 === h % 12);
  const pickHour = (hour: number) => set(format === '24h' ? hour : (hour % 12) + (pm ? 12 : 0), m);

  const cell = (text: string, selected: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      key={text}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '14%',
        flexGrow: 1,
        height: 40,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? theme.primary : theme.surfaceMuted,
        opacity: pressed ? 0.75 : 1,
      })}>
      <AppText variant="label" style={{ color: selected ? theme.primaryText : theme.text }}>
        {text}
      </AppText>
    </Pressable>
  );

  return (
    <View
      accessibilityLabel={`Pick the ${label.toLowerCase()} time`}
      style={{
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="heading">{formatTime(current)}</AppText>
      </View>

      <AppText variant="caption" muted>
        Hour
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {hours.map((hour) =>
          cell(
            format === '24h' ? String(hour).padStart(2, '0') : String(hour),
            hourSelected(hour),
            () => pickHour(hour),
            `${hour} o'clock`,
          ),
        )}
      </View>

      <AppText variant="caption" muted>
        Minute
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MINUTES.map((minute) =>
          cell(`:${String(minute).padStart(2, '0')}`, minute === m, () => set(h, minute), `${minute} minutes`),
        )}
      </View>

      {format === '24h' ? null : (
        <Segmented
          options={[
            { value: 'am', label: 'AM' },
            { value: 'pm', label: 'PM' },
          ]}
          value={pm ? 'pm' : 'am'}
          onChange={(v) => set((h % 12) + (v === 'pm' ? 12 : 0), m)}
        />
      )}

      <Button
        compact
        label="Done"
        onPress={() => {
          // Picking nothing still fills in the time shown.
          if (!parseTime(value)) set(h, m);
          onDone();
        }}
      />
    </View>
  );
}

type TimeBox = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** "HH:MM" shown as the placeholder and where the picker starts. */
  example: string;
  error?: string | null;
};

/**
 * Two time boxes side by side (start and end, lunch out and back). Each can be
 * typed in or filled from the picker, which opens across the full width below.
 */
export function TimePair({ first, second }: { first: TimeBox; second: TimeBox }) {
  const [open, setOpen] = useState<0 | 1 | null>(null);
  useTimeFormat();
  const boxes = [first, second];
  const picking = open === null ? null : boxes[open];
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        {boxes.map((box, i) => (
          <View key={box.label} style={{ flex: 1, minWidth: 0 }}>
            <Field
              label={box.label}
              value={box.value}
              onChangeText={box.onChange}
              placeholder={formatTime(box.example)}
              autoCapitalize="none"
              error={box.error}
              accessory={
                <IconButton
                  icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                  label={
                    open === i
                      ? `Close the ${box.label.toLowerCase()} picker`
                      : `Pick the ${box.label.toLowerCase()} time`
                  }
                  onPress={() => setOpen(open === i ? null : (i as 0 | 1))}
                />
              }
            />
          </View>
        ))}
      </View>
      {picking ? (
        <TimePicker
          label={picking.label}
          value={picking.value}
          fallback={
            open === 1 && parseTime(first.value) ? laterThan(parseTime(first.value)!, second.example) : picking.example
          }
          onChange={picking.onChange}
          onDone={() => setOpen(null)}
        />
      ) : null}
    </View>
  );
}

/** Where the second picker starts: its example, or an hour after the first time if that's later. */
function laterThan(firstTime: string, example: string) {
  const [h, m] = firstTime.split(':').map(Number);
  const next = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return next > example ? next : example;
}
