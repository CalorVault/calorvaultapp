import { useCallback, useEffect, useState } from 'react';
import { WeekStripDay } from '../components/WeekStrip';
import { getDayLogs, lastNDates } from '../storage/db';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useWeekDays(targetCalories: number, refreshKey?: unknown) {
  const [days, setDays] = useState<WeekStripDay[]>([]);

  const load = useCallback(async () => {
    const dates = lastNDates(7);
    const logs = await getDayLogs(dates);
    setDays(
      logs.map((log) => ({
        date: log.date,
        dayLabel: DAY_LABELS[new Date(log.date + 'T00:00:00').getDay()],
        totalCalories: log.entries.reduce((sum, e) => sum + e.calories, 0),
        target: targetCalories,
        hasEntries: log.entries.length > 0,
      }))
    );
  }, [targetCalories]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { days, reload: load };
}
