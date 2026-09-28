import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { type Holiday, useDeleteHoliday, useSaveHoliday } from '@/features/schedule';
import { confirmAction, errorMessage, goBack } from '@/lib/confirm';
import { isDay, longDay, today } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export default function HolidayScreen() {
  const { id, year } = useLocalSearchParams<{ id?: string; year?: string }>();
  const holiday = useQuery({
    queryKey: ['schedule', 'holidays', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (id && holiday.isPending) return <Loading />;
  if (id && !holiday.data) {
    return (
      <Screen underHeader>
        <AppText muted>This holiday was deleted.</AppText>
      </Screen>
    );
  }
  const now = today();
  const startDate = year && year !== now.slice(0, 4) ? `${year}-01-01` : now;
  return <HolidayForm key={holiday.data?.id ?? 'new'} existing={holiday.data ?? undefined} startDate={startDate} />;
}

function HolidayForm({ existing, startDate }: { existing?: Holiday; startDate: string }) {
  const save = useSaveHoliday();
  const remove = useDeleteHoliday();
  const [name, setName] = useState(existing?.name ?? '');
  const [date, setDate] = useState(existing?.holiday_date ?? startDate);
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    const next = {
      name: name.trim() ? undefined : 'Enter a name.',
      date: isDay(date) ? undefined : 'Use a real date like 2026-12-25.',
    };
    setErrors(next);
    if (next.name || next.date) return;
    setError(null);
    try {
      await save.mutateAsync({ id: existing?.id, values: { name: name.trim(), holiday_date: date } });
      goBack('/more');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(`Delete ${existing.name}?`, 'Shifts on that day stay on the schedule.', 'Delete');
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      goBack('/more');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: existing ? existing.name : 'Add holiday' }} />
      <Card>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Thanksgiving" error={errors.name} />
        <Field
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.date}
        />
        {isDay(date) ? <AppText muted>{longDay(date)}</AppText> : null}
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button label={existing ? 'Save changes' : 'Add holiday'} onPress={onSave} loading={save.isPending} />
      {existing ? (
        <Button label="Delete holiday" variant="danger" onPress={onDelete} disabled={remove.isPending} />
      ) : null}
    </Screen>
  );
}
