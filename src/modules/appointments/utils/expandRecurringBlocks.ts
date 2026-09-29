import { addDays, format, isAfter, isBefore, startOfDay } from 'date-fns';

import IBlockPeriod from '../dtos/IBlockPeriod';
import RecurringTimeBlock from '../infra/typeorm/entities/RecurringTimeBlock';
import workWindow from './workWindow';

// Os dias de cada repetição que ocupam parte do intervalo pedido, como
// períodos bloqueados comuns
export default function expandRecurringBlocks(
  rules: RecurringTimeBlock[],
  start: Date,
  end: Date,
): IBlockPeriod[] {
  const periods: IBlockPeriod[] = [];

  for (let day = startOfDay(start); isBefore(day, end); day = addDays(day, 1)) {
    const date = format(day, 'yyyy-MM-dd');

    rules.forEach(rule => {
      if (
        !rule.days_of_week.includes(day.getDay()) ||
        date < rule.starts_on ||
        (rule.ends_on && date > rule.ends_on)
      ) {
        return;
      }

      const { workStart, workEnd } = workWindow(day, rule);

      if (!isBefore(workStart, end) || !isAfter(workEnd, start)) return;

      periods.push({
        id: rule.id,
        provider_id: rule.provider_id,
        start_date: workStart,
        end_date: workEnd,
        reason: rule.reason,
        recurrence: {
          days_of_week: rule.days_of_week,
          start_time: rule.start_time,
          end_time: rule.end_time,
          starts_on: rule.starts_on,
          ends_on: rule.ends_on,
        },
      });
    });
  }

  return periods;
}
