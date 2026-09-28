import { AppText, ComingSoon, Screen } from '@/components/ui';

export default function TimecardsScreen() {
  return (
    <Screen>
      <AppText variant="title">Timecards</AppText>
      <ComingSoon
        phase="Coming in phase 5"
        title="Clock in and track hours"
        items={[
          'One-tap clock in, lunch, and clock out',
          'Weekly hours with lunch subtracted',
          'Fix or add a missed day',
        ]}
      />
    </Screen>
  );
}
