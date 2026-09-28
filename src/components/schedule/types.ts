import type { Holiday, Shift, TimeOffEntry } from '@/features/schedule';
import type { Crew } from '@/features/team';

/** Everything a schedule view draws, already limited to crew on the schedule. */
export type ScheduleData = {
  crew: Crew[];
  crewById: Map<string, Crew>;
  shifts: Shift[];
  timeOff: TimeOffEntry[];
  holidays: Holiday[];
  today: string;
};
