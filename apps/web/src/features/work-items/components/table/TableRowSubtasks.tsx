import { CornerDownRight } from 'lucide-react';
import type { SyntheticEvent } from 'react';
import type { DeliveryItem } from '@/lib/api/endpoints/deliveryWorkflow';
import { type Maps } from '@/utils/project';
import { cn } from '@/lib/utils';
import { noDragProps } from '@/lib/dnd';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useSubtasks } from '../../context/useSubtasks';
import { columnKey, type OrderedColumn } from '../../utils/table';
import { SubtaskProgress } from '../shared/SubtaskProgress';
import DeliveryProgressBadge from '../shared/DeliveryProgressBadge';
import { TableBuiltinCell } from './TableBuiltinCell';
import { TableCustomCell } from './TableCustomCell';

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function TableRowSubtasks({
  issueId,
  maps,
  orderedColumns,
  showId,
  alignTop,
  onOpenIssue,
  deliveryById,
}: {
  issueId: number;
  maps: Maps;
  orderedColumns: OrderedColumn[];
  showId: boolean;
  alignTop: boolean;
  onOpenIssue: (id: number) => void;
  deliveryById?: Map<number, DeliveryItem>;
}) {
  const subtasks = useSubtasks(issueId);
  if (subtasks.length === 0) return null;
  const showsStatus = orderedColumns.some(
    (column) => column.kind === 'builtin' && column.col === 'status',
  );

  return (
    <div
      className="col-span-full grid grid-cols-subgrid"
      {...noDragProps}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      {subtasks.map((subtask) => {
        const delivery = deliveryById?.get(subtask.id);
        const column = maps.columnById.get(subtask.columnId);
        const done = column?.stateType === 'completed';
        return (
          <div
            key={subtask.id}
            className={cn(
              'col-span-full grid grid-cols-subgrid rounded py-1 hover:bg-accent/50',
              alignTop ? 'items-start' : 'items-center',
            )}
          >
            <button
              type="button"
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded ps-6 text-start text-xs text-muted-foreground hover:text-foreground"
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
              <SubtaskProgress issueId={subtask.id} maps={maps} />
              {delivery && <DeliveryProgressBadge item={delivery} />}
            </button>
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
        );
      })}
    </div>
  );
}
