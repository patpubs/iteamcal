import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, Divider, ErrorText, IconButton, ListRow, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useHolidays } from '@/features/schedule';
import { errorMessage } from '@/lib/confirm';
import { longDay, today } from '@/lib/dates';

export default function HolidaysScreen() {
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const holidays = useHolidays(`${year}-01-01`, `${year}-12-31`);

  return (
    <Screen underHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          label="Previous year"
          onPress={() => setYear((y) => y - 1)}
        />
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>
          {String(year)}
        </AppText>
        <IconButton
          icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          label="Next year"
          onPress={() => setYear((y) => y + 1)}
        />
      </View>

      <ErrorText>{holidays.error ? errorMessage(holidays.error) : null}</ErrorText>
      {holidays.isPending ? (
        <Loading />
      ) : (
        <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
          {holidays.data?.length ? (
            holidays.data.map((h, i) => (
              <View key={h.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={h.name}
                  subtitle={longDay(h.holiday_date)}
                  onPress={() => router.push({ pathname: '/more/holiday', params: { id: h.id } })}
                />
              </View>
            ))
          ) : (
            <AppText muted style={{ paddingVertical: Spacing.md }}>
              No office holidays in {year}.
            </AppText>
          )}
        </Card>
      )}
      <Button
        label="Add holiday"
        onPress={() => router.push({ pathname: '/more/holiday', params: { year: String(year) } })}
      />
      <AppText variant="caption" muted>
        Holidays show on everyone’s schedule as “Office closed”. They don’t remove shifts or add paid hours.
      </AppText>
    </Screen>
  );
}
