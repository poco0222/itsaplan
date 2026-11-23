import { useIconHover } from '@animateicons/react';
import { ChevronDownIcon } from '@animateicons/react/lucide/chevron-down-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useFormatter, useTranslations } from 'next-intl';
import type { PlanDeliveryProgress } from '@/lib/api/endpoints/initiatives';
import { cn } from '@/lib/utils';
import { type IssueGroup } from '@/utils/project';
import { GroupDot } from '../shared/GroupDot';
import { HeaderIconButton } from '../shared/HeaderIconButton';
import { TableDropZone } from './TableDropZone';

// A primary group header row. A drop onto it appends to the group's bucket
// (disabled when sub-grouped, where issues live under sub-headers).
export function TableSectionHeader({
  group,
  count,
  collapsed,
  disabled,
  dropId,
  onDrop,
  onToggle,
  onAddIssue,
  canAdd,
  planProgress,
}: {
  group: IssueGroup;
  count: number;
  collapsed: boolean;
  disabled: boolean;
  dropId: string;
  onDrop: (issueId: number) => void;
  onToggle: () => void;
  onAddIssue: () => void;
  canAdd: boolean;
  planProgress?: {
    delivery: PlanDeliveryProgress;
    column: number;
    gridTemplate: string;
    lastColumn: boolean;
  };
}) {
  const t = useTranslations('workItems');
  const deliveryT = useTranslations('issue.deliveryWorkflow');
  const format = useFormatter();
  const { ref, triggerProps } = useIconHover();
  const Chevron = collapsed ? ChevronRightIcon : ChevronDownIcon;
  const delivery = planProgress?.delivery;
  let progressText;
  if (delivery) {
    progressText =
      delivery.progress === null
        ? deliveryT(`problems.${delivery.problem ?? 'progress'}`)
        : format.number(delivery.progress / 100, { style: 'percent', maximumFractionDigits: 1 });
  }
  return (
    <TableDropZone
      id={dropId}
      disabled={disabled}
      onDrop={onDrop}
      className={cn(
        'items-center bg-muted/40 px-4 py-1.5',
        planProgress ? 'relative grid gap-3' : 'flex justify-between',
      )}
      style={planProgress && { gridTemplateColumns: planProgress.gridTemplate }}
    >
      <button
        type="button"
        {...triggerProps}
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={cn(
          'flex items-center gap-2 text-sm font-medium text-foreground',
          planProgress && 'w-fit min-w-0',
        )}
      >
        <Chevron ref={ref} size={14} className="shrink-0 text-muted-foreground" />
        <GroupDot group={group} />
        <span dir="auto" className={planProgress ? 'truncate' : undefined}>
          {group.name}
        </span>
        <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </button>
      {planProgress && (
        <span
          className={cn(
            'truncate text-xs text-muted-foreground tabular-nums',
            canAdd && planProgress.lastColumn && 'pe-3',
          )}
          style={{ gridColumn: planProgress.column }}
          title={progressText}
        >
          {progressText}
        </span>
      )}
      {canAdd && (
        <HeaderIconButton
          icon={PlusIcon}
          label={t('newIssue')}
          onClick={onAddIssue}
          className={cn(
            planProgress && 'absolute top-1/2 -translate-y-1/2',
            planProgress && (planProgress.lastColumn ? 'end-1' : 'end-4'),
          )}
        />
      )}
    </TableDropZone>
  );
}
