import { CornerDownRight } from 'lucide-react';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import type { Issue } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import type { Maps } from '@/utils/project';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useSubtaskFold, useSubtasks } from '../../context/useSubtasks';
import { columnKey, type OrderedColumn } from '../../utils/table';
import DeliveryProgressBadge from '../shared/DeliveryProgressBadge';
import { SubtaskProgress } from '../shared/SubtaskProgress';
import { TableBuiltinCell } from './TableBuiltinCell';
import { TableCustomCell } from './TableCustomCell';

export function TableSubtaskRow({
  subtask,
  nested = false,
  ...rowProps
}: {
  subtask: Issue;
  nested?: boolean;
  maps: Maps;
  orderedColumns: OrderedColumn[];
  showId: boolean;
  alignTop: boolean;
  onOpenIssue: (id: number) => void;
  deliveryById?: Map<number, DeliveryItem>;
}) {
  const { maps, orderedColumns, showId, alignTop, onOpenIssue, deliveryById } = rowProps;
  const children = useSubtasks(subtask.id);
  const { open, toggle } = useSubtaskFold();
  const delivery = deliveryById?.get(subtask.id);
  const column = maps.columnById.get(subtask.columnId);
  const done = column?.stateType === 'completed';
  const showsStatus = orderedColumns.some((col) => col.kind === 'builtin' && col.col === 'status');

  return (
    <>
      <div
        className={cn(
          'col-span-full grid grid-cols-subgrid rounded py-1 hover:bg-accent/50',
          alignTop ? 'items-start' : 'items-center',
        )}
      >
        <div className={cn('flex min-w-0 items-center gap-2', nested ? 'ps-12' : 'ps-6')}>
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-2 rounded text-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onOpenIssue(subtask.id)}
          >
            <CornerDownRight className="size-3 shrink-0 text-muted-foreground/60" />
            {!showsStatus && column && (
              <StateIcon
                stateType={column.stateType}
                color={column.color}
                className="size-3.5 shrink-0"
              />
            )}
            {showId && <span className="shrink-0 tabular-nums">{subtask.identifier}</span>}
            <span
              dir="auto"
              className={cn('truncate', done && 'text-muted-foreground/60 line-through')}
            >
              {subtask.title}
            </span>
            {delivery && <DeliveryProgressBadge item={delivery} />}
          </button>
          <SubtaskProgress
            issueId={subtask.id}
            maps={maps}
            open={open}
            onToggle={nested ? undefined : toggle}
          />
        </div>
        {orderedColumns.map((column) =>
          column.kind === 'builtin' ? (
            <TableBuiltinCell
              key={columnKey(column)}
              column={column.col}
              issue={subtask}
              maps={maps}
            />
          ) : (
            <TableCustomCell
              key={columnKey(column)}
              field={column.field}
              issue={subtask}
              maps={maps}
            />
          ),
        )}
      </div>
      {!nested &&
        open &&
        children.map((child) => (
          <TableSubtaskRow key={child.id} subtask={child} nested {...rowProps} />
        ))}
    </>
  );
}
