import { AppText, ComingSoon, Screen } from '@/components/ui';

export default function TimeOffScreen() {
  return (
    <Screen>
      <AppText variant="title">Time off</AppText>
      <ComingSoon
        phase="Coming in phase 4"
        title="Requests and days off"
        items={[
          'Request vacation, sick, personal, or other time off',
          'See your request status and your manager’s note',
          'Monthly list and calendar of days off',
        ]}
      />
    </Screen>
  );
}
