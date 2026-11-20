import { useContext } from 'react';
import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { DateBadge, OVERDUE_PILL, PILL } from '@/features/issue/components/shared/IssueBadges';
import type { StateType } from '@/lib/api/endpoints/columns';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import { daysBetween, formatShortDate, parseDate, toDateStr } from '@/utils/dates';
import { STATUS_META } from '@/utils/initiativeMeta';
import { cn } from '@/lib/utils';
import { KanbanDeadlineContext } from '../../context/kanbanDeadlineContext';

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = parseDate(value);
  return date && toDateStr(date) === value ? date : null;
}

export function IssueCardDeadline({
  issue,
  dueDate,
  stateType,
}: {
  issue: Pick<BoardIssue, 'fieldValues'> & { id?: number };
  dueDate: string;
  stateType?: StateType;
}) {
  const t = useTranslations('workItems');
  const { today, actualDateFieldId, deliveryById } = useContext(KanbanDeadlineContext);
  const due = validDate(dueDate);
  const currentDay = parseDate(today);
  const remaining = due && currentDay ? daysBetween(currentDay, due) : null;
  const open = stateType !== 'completed' && stateType !== 'canceled';
  const upcoming =
    stateType === 'started' && remaining !== null && remaining >= 0 && remaining <= 5;
  const urgent = upcoming && remaining <= 3;
  const delivery = issue.id === undefined ? undefined : deliveryById?.get(issue.id);
  const actualDate = delivery
    ? delivery.completedAt && toDateStr(new Date(delivery.completedAt))
    : issue.fieldValues.find((field) => field.fieldId === actualDateFieldId)?.value;
  const actual = stateType === 'completed' ? validDate(actualDate) : null;

  return (
    <>
      <DateBadge
        icon={<CalendarClock className="size-2.5" />}
        date={dueDate}
        label={t('columns.dueDate')}
        overdue={open && remaining !== null && remaining < 0}
      />
      {upcoming && (
        <Badge
          variant="outline"
          style={urgent ? { backgroundColor: STATUS_META.active.color } : undefined}
          className={cn(
            PILL,
            'border-transparent',
            urgent ? 'text-pro-foreground' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
          )}
        >
          {urgent ? t('deadline.dueWithinThreeDays') : t('deadline.dueWithinFiveDays')}
        </Badge>
      )}
      {actual && due && actual > due && (
        <Badge variant="outline" className={cn(PILL, OVERDUE_PILL)}>
          {t('deadline.completedLate', { date: formatShortDate(toDateStr(actual)) })}
        </Badge>
      )}
    </>
  );
}
