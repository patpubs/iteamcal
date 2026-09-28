import { format } from 'date-fns';

import { AppText, ComingSoon, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth';

export default function ScheduleScreen() {
  const { profile } = useAuth();
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <Screen>
      <AppText muted>{format(new Date(), 'EEEE, MMMM d')}</AppText>
      <AppText variant="title">{firstName ? `Hi, ${firstName}` : 'Schedule'}</AppText>
      <ComingSoon
        phase="Coming in phase 2"
        title="Team schedule"
        items={[
          'Week, month, and list views, starting Monday',
          'Shifts, holidays, and days off in one place',
          'Duplicate shifts, copy a week, and drag to move',
        ]}
      />
    </Screen>
  );
}
