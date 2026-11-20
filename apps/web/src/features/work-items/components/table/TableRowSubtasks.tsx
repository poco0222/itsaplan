import type { ComponentProps, SyntheticEvent } from 'react';
import { noDragProps } from '@/lib/dnd';
import { useSubtasks } from '../../context/useSubtasks';
import { TableSubtaskRow } from './TableSubtaskRow';

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function TableRowSubtasks({
  issueId,
  ...rowProps
}: Omit<ComponentProps<typeof TableSubtaskRow>, 'subtask' | 'nested'> & { issueId: number }) {
  const subtasks = useSubtasks(issueId);
  if (subtasks.length === 0) return null;

  return (
    <div
      className="col-span-full grid grid-cols-subgrid"
      {...noDragProps}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      {subtasks.map((subtask) => (
        <TableSubtaskRow key={subtask.id} subtask={subtask} {...rowProps} />
      ))}
    </div>
  );
}
