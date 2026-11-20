import { useContext } from 'react';
import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { DateBadge, PILL } from '@/features/issue/components/shared/IssueBadges';
import type { StateType } from '@/lib/api/endpoints/columns';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import { daysBetween, formatShortDate, parseDate, toDateStr } from '@/utils/dates';
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
  issue: Pick<BoardIssue, 'fieldValues'>;
  dueDate: string;
  stateType?: StateType;
}) {
  const t = useTranslations('workItems');
  const { today, actualDateFieldId } = useContext(KanbanDeadlineContext);
  const due = validDate(dueDate);
  const currentDay = parseDate(today);
  const remaining = due && currentDay ? daysBetween(currentDay, due) : null;
  const open = stateType !== 'completed' && stateType !== 'canceled';
  const upcoming =
    stateType === 'started' && remaining !== null && remaining >= 0 && remaining <= 5;
  const urgent = upcoming && remaining <= 3;
  const actual =
    stateType === 'completed' && actualDateFieldId !== undefined
      ? validDate(issue.fieldValues.find((field) => field.fieldId === actualDateFieldId)?.value)
      : null;

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
          className={cn(
            PILL,
            'text-warning',
            urgent && 'border-transparent bg-warning/15 font-medium',
          )}
        >
          {urgent ? t('deadline.dueWithinThreeDays') : t('deadline.dueWithinFiveDays')}
        </Badge>
      )}
      {actual && due && actual > due && (
        <Badge variant="outline" className={cn(PILL, 'text-warning')}>
          {t('deadline.completedLate', { date: formatShortDate(toDateStr(actual)) })}
        </Badge>
      )}
    </>
  );
}
